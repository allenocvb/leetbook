import type { DesignQuestionInput } from "@leetbook/core";
import { isPerformanceScore } from "@leetbook/core";
import type {
  GenerateQuestionsInput,
  GradeAnswerInput,
  GradedAnswer,
  QuizProvider,
} from "./quizProvider.js";
import { QuizProviderError } from "./quizProvider.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";

export interface AnthropicOptions {
  apiKey: string;
  model?: string;
  /** Injected so tests never make a network call. */
  fetchFn?: typeof fetch;
}

/**
 * Anthropic-backed quiz provider.
 *
 * Uses a tool definition rather than "reply with JSON" because a schema the API enforces is
 * far harder to drift from than an instruction in a prompt — and a malformed question is one
 * the user cannot answer.
 */
export function createAnthropicProvider({
  apiKey,
  model = DEFAULT_MODEL,
  fetchFn = fetch,
}: AnthropicOptions): QuizProvider {
  const call = async (body: unknown): Promise<unknown> => {
    if (apiKey.trim() === "") {
      throw new QuizProviderError("No API key is set.", "no-key");
    }

    let response: Response;
    try {
      response = await fetchFn(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
          /*
           * A Tauri webview is a browser origin, and the API rejects those by default with a
           * CORS failure. The header is Anthropic's documented opt-in. It is "dangerous" for
           * web apps, where it would expose a key to every visitor — here the key is the
           * user's own, held in their keychain, on their machine.
           */
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new QuizProviderError(
        `Couldn't reach the provider: ${cause instanceof Error ? cause.message : cause}`,
        "network",
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new QuizProviderError("That API key was rejected.", "auth");
    }
    if (response.status === 429) {
      throw new QuizProviderError("Rate limited by the provider. Try again shortly.", "rate-limit");
    }
    if (!response.ok) {
      throw new QuizProviderError(`Provider returned ${response.status}.`, "network");
    }
    return response.json();
  };

  return {
    async generateQuestions(input) {
      const result = await call({
        model,
        max_tokens: 2048,
        tool_choice: { type: "tool", name: "write_questions" },
        tools: [QUESTION_TOOL],
        messages: [{ role: "user", content: generatePrompt(input) }],
      });
      return parseQuestions(result);
    },

    async gradeAnswer(input) {
      const result = await call({
        model,
        max_tokens: 512,
        tool_choice: { type: "tool", name: "grade_answer" },
        tools: [GRADE_TOOL],
        messages: [{ role: "user", content: gradePrompt(input) }],
      });
      return parseGrade(result);
    },
  };
}

const QUESTION_TOOL = {
  name: "write_questions",
  description: "Return quiz questions about the system design topic.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["choice", "text"] },
            prompt: { type: "string" },
            choices: { type: "array", items: { type: "string" } },
            answerIndex: { type: "integer" },
            modelAnswer: { type: "string" },
          },
          required: ["kind", "prompt", "modelAnswer"],
        },
      },
    },
    required: ["questions"],
  },
} as const;

const GRADE_TOOL = {
  name: "grade_answer",
  description: "Score how well the answer matches the model answer.",
  input_schema: {
    type: "object",
    properties: {
      suggestedScore: { type: "integer", minimum: 0, maximum: 5 },
      reasoning: { type: "string" },
    },
    required: ["suggestedScore", "reasoning"],
  },
} as const;

export function generatePrompt({ title, prompt, notes, count }: GenerateQuestionsInput): string {
  return [
    `Write ${count} quiz questions to test recall of this system design topic.`,
    "",
    `Topic: ${title}`,
    prompt.trim() === "" ? "" : `Question posed: ${prompt}`,
    "",
    "The person's own notes:",
    notes.trim() === "" ? "(no notes written yet)" : notes,
    "",
    // Questions about material the person never wrote are unanswerable from their own notes,
    // which makes the resulting score meaningless as a memory signal.
    "Base every question on the notes above. Do not test facts the notes do not contain.",
    "Mix multiple choice and written answers. For multiple choice give 3–4 plausible options",
    "and set answerIndex to the correct one. Always fill modelAnswer with a short explanation.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function gradePrompt({ question, modelAnswer, answer }: GradeAnswerInput): string {
  return [
    "Score how well the answer demonstrates recall, from 0 to 5.",
    "0 blackout · 1 familiar once seen · 2 knew the approach after a hint ·",
    "3 correct with struggle · 4 correct with hesitation · 5 perfect recall.",
    "",
    `Question: ${question}`,
    `Model answer: ${modelAnswer}`,
    `Their answer: ${answer}`,
    "",
    // A grader that rewards effort teaches the schedule to forget things the person cannot
    // actually recall. Saying so plainly is cheaper than discovering it months later.
    "Judge recall of the substance, not writing quality or length. Do not be generous:",
    "an inflated score pushes this topic weeks away and the person stops seeing it.",
  ].join("\n");
}

/** The tool-use block from a Messages response, or null if the model did not call the tool. */
function toolInput(result: unknown): Record<string, unknown> | null {
  const content = (result as { content?: unknown[] })?.content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    const typed = block as { type?: string; input?: unknown };
    if (typed.type === "tool_use" && typed.input && typeof typed.input === "object") {
      return typed.input as Record<string, unknown>;
    }
  }
  return null;
}

/**
 * Turns a tool response into questions, dropping any that would not survive the repo's
 * validation.
 *
 * Filtering rather than throwing: one malformed question out of six should cost that
 * question, not the whole generation the user just paid for.
 */
export function parseQuestions(result: unknown): DesignQuestionInput[] {
  const input = toolInput(result);
  const raw = input?.questions;
  if (!Array.isArray(raw)) {
    throw new QuizProviderError("The provider did not return any questions.", "bad-response");
  }

  const questions: DesignQuestionInput[] = [];
  for (const item of raw) {
    const q = item as Record<string, unknown>;
    const prompt = typeof q.prompt === "string" ? q.prompt.trim() : "";
    const modelAnswer = typeof q.modelAnswer === "string" ? q.modelAnswer : "";
    if (prompt === "") continue;

    if (q.kind === "choice") {
      /*
       * Blank options are dropped, so the answer index has to be remapped onto what is left —
       * the same trap the authoring dialog has. Checking the original index against the
       * shortened list rejects perfectly good questions, and mapping it carelessly would
       * silently mark the wrong option correct.
       */
      const original = Array.isArray(q.choices) ? q.choices : [];
      const kept = original
        .map((choice, index) => ({ choice, index }))
        .filter(
          (entry): entry is { choice: string; index: number } =>
            typeof entry.choice === "string" && entry.choice.trim() !== "",
        );
      const answerIndex = kept.findIndex(
        (entry) => entry.index === (typeof q.answerIndex === "number" ? q.answerIndex : -1),
      );
      // Mirrors the repo's rules, so nothing reaches the database that it would reject.
      if (kept.length < 2 || answerIndex < 0) continue;
      questions.push({
        kind: "choice",
        prompt,
        choices: kept.map((entry) => entry.choice.trim()),
        answerIndex,
        modelAnswer,
      });
    } else if (q.kind === "text") {
      questions.push({ kind: "text", prompt, modelAnswer });
    }
  }

  if (questions.length === 0) {
    throw new QuizProviderError("None of the returned questions were usable.", "bad-response");
  }
  return questions;
}

export function parseGrade(result: unknown): GradedAnswer {
  const input = toolInput(result);
  const score = input?.suggestedScore;
  if (!isPerformanceScore(score)) {
    throw new QuizProviderError("The provider did not return a 0–5 score.", "bad-response");
  }
  return {
    suggestedScore: score,
    reasoning: typeof input?.reasoning === "string" ? input.reasoning : "",
  };
}

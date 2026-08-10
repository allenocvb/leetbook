import { describe, expect, it, vi } from "vitest";
import {
  createAnthropicProvider,
  generatePrompt,
  parseGrade,
  parseQuestions,
} from "./anthropic.js";
import { QuizProviderError } from "./quizProvider.js";

/** A Messages response whose tool_use block carries `input`. */
const toolResponse = (input: unknown) => ({
  content: [
    { type: "text", text: "thinking" },
    { type: "tool_use", name: "t", input },
  ],
});

/* Typed like `fetch` so `mock.calls` carries the url and init rather than an empty tuple. */
const ok = (body: unknown) =>
  vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status: 200 }),
  );

const status = (code: number) =>
  vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: code }),
  );

const GENERATE = {
  title: "URL shortener",
  prompt: "Design a link shortener.",
  notes: "Use base62 over an auto-increment id. Cache hot links.",
  count: 4,
};

describe("parseQuestions", () => {
  it("reads both kinds out of a tool response", () => {
    const parsed = parseQuestions(
      toolResponse({
        questions: [
          {
            kind: "choice",
            prompt: "Which store?",
            choices: ["SQL", "KV"],
            answerIndex: 1,
            modelAnswer: "Single-key lookups.",
          },
          { kind: "text", prompt: "How would you shard?", modelAnswer: "By key hash." },
        ],
      }),
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ kind: "choice", answerIndex: 1 });
    expect(parsed[1]).toMatchObject({ kind: "text", prompt: "How would you shard?" });
  });

  /*
   * The parser enforces the same rules as the repo, so a model can never put a question into
   * the database that the database would reject — the failure would otherwise surface
   * mid-review, as a question with no right answer.
   */
  it("drops questions the repo would refuse, keeping the rest", () => {
    const parsed = parseQuestions(
      toolResponse({
        questions: [
          { kind: "choice", prompt: "Lonely", choices: ["only one"], answerIndex: 0 },
          { kind: "choice", prompt: "Out of range", choices: ["a", "b"], answerIndex: 9 },
          { kind: "text", prompt: "   ", modelAnswer: "blank prompt" },
          { kind: "text", prompt: "Good one", modelAnswer: "kept" },
        ],
      }),
    );

    // One bad question out of four should not cost the user the whole generation.
    expect(parsed.map((q) => q.prompt)).toEqual(["Good one"]);
  });

  /*
   * Blank options are dropped, so the marked index has to move with them — the same trap the
   * authoring dialog has. Index 2 of ["a", "", "b"] is "b", which is index 1 once the blank
   * is gone. Comparing against the original list would throw the question away; mapping it
   * carelessly would mark "a" correct instead.
   */
  it("remaps the answer index when blank options are dropped", () => {
    const parsed = parseQuestions(
      toolResponse({
        questions: [
          { kind: "choice", prompt: "Q", choices: ["a", "", "b"], answerIndex: 2, modelAnswer: "" },
        ],
      }),
    );
    expect(parsed[0]).toMatchObject({ choices: ["a", "b"], answerIndex: 1 });
  });

  it("throws when nothing usable came back", () => {
    expect(() => parseQuestions(toolResponse({ questions: [] }))).toThrow(QuizProviderError);
    expect(() => parseQuestions(toolResponse({}))).toThrow(/did not return any questions/);
    expect(() => parseQuestions({ content: [{ type: "text", text: "no tool call" }] })).toThrow(
      QuizProviderError,
    );
  });
});

describe("parseGrade", () => {
  it("reads the suggested score and reasoning", () => {
    expect(parseGrade(toolResponse({ suggestedScore: 3, reasoning: "Missed caching." }))).toEqual({
      suggestedScore: 3,
      reasoning: "Missed caching.",
    });
  });

  it("rejects a score outside the rubric rather than clamping it", () => {
    // Clamping would invent a score the model never gave, and it feeds FSRS.
    expect(() => parseGrade(toolResponse({ suggestedScore: 9 }))).toThrow(/0–5/);
    expect(() => parseGrade(toolResponse({ suggestedScore: "4" }))).toThrow(QuizProviderError);
  });
});

describe("generatePrompt", () => {
  it("includes the notes and pins questions to them", () => {
    const text = generatePrompt(GENERATE);
    expect(text).toContain("base62");
    // Questions about material the user never wrote cannot measure their recall.
    expect(text).toContain("Do not test facts the notes do not contain");
  });

  it("says so when there are no notes, rather than sending an empty section", () => {
    expect(generatePrompt({ ...GENERATE, notes: "  " })).toContain("(no notes written yet)");
  });
});

describe("createAnthropicProvider", () => {
  it("sends the key and version headers", async () => {
    const fetchFn = ok(
      toolResponse({ questions: [{ kind: "text", prompt: "Q", modelAnswer: "" }] }),
    );
    const provider = createAnthropicProvider({ apiKey: "sk-test", fetchFn });

    await provider.generateQuestions(GENERATE);

    const init = fetchFn.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test");
    expect(headers["anthropic-version"]).toBeDefined();
    // Without this the API rejects the Tauri webview's origin outright.
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  });

  it("refuses to call out with no key", async () => {
    const fetchFn = ok({});
    const provider = createAnthropicProvider({ apiKey: "  ", fetchFn });

    await expect(provider.generateQuestions(GENERATE)).rejects.toThrow(/No API key/);
    // Nothing should leave the machine when there is no key to use.
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    [401, "auth"],
    [429, "rate-limit"],
    [500, "network"],
  ])("maps HTTP %i to a %s failure the UI can act on", async (code, kind) => {
    const provider = createAnthropicProvider({ apiKey: "sk", fetchFn: status(code) });
    await expect(provider.generateQuestions(GENERATE)).rejects.toMatchObject({ kind });
  });

  it("reports an unreachable provider rather than throwing a raw fetch error", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const provider = createAnthropicProvider({ apiKey: "sk", fetchFn });

    await expect(provider.generateQuestions(GENERATE)).rejects.toMatchObject({ kind: "network" });
  });

  it("grades an answer end to end against a recorded response", async () => {
    const fetchFn = ok(toolResponse({ suggestedScore: 4, reasoning: "Solid, missed the cache." }));
    const provider = createAnthropicProvider({ apiKey: "sk", fetchFn });

    const graded = await provider.gradeAnswer({
      question: "How would you shard?",
      modelAnswer: "By key hash.",
      answer: "Hash the key and mod by shard count.",
    });

    expect(graded.suggestedScore).toBe(4);
    expect(graded.reasoning).toContain("cache");
  });
});

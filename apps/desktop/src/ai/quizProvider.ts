import type { DesignQuestionInput, PerformanceScore } from "@leetbook/core";

/**
 * What the app needs from an AI backend, and nothing more.
 *
 * Two methods, both pure request/response. Keeping the surface this small is what makes a
 * local backend (Ollama) a later addition rather than a rewrite, and it is why every caller
 * can be tested without a key or a network.
 */
export interface QuizProvider {
  /** Draft questions from a topic's notes. The user reviews and edits before anything saves. */
  generateQuestions(input: GenerateQuestionsInput): Promise<DesignQuestionInput[]>;
  /** Grade one free-text answer. Returns a *suggestion*; the user decides the real score. */
  gradeAnswer(input: GradeAnswerInput): Promise<GradedAnswer>;
}

export interface GenerateQuestionsInput {
  title: string;
  prompt: string;
  /** The topic's notes as plain text. Sending prose, not TipTap JSON. */
  notes: string;
  /** How many to ask for. The model may return fewer. */
  count: number;
}

export interface GradeAnswerInput {
  question: string;
  modelAnswer: string;
  answer: string;
}

export interface GradedAnswer {
  /**
   * What the model would score this, 0–5.
   *
   * Deliberately named a suggestion everywhere it travels. It is never written to the review
   * log directly: a lenient grader would push a topic weeks out while looking like it worked,
   * and the schedule would rot invisibly. The user confirms or overrides.
   */
  suggestedScore: PerformanceScore;
  /** Why, in a sentence or two. Shown to the user so they can disagree with reasons. */
  reasoning: string;
}

/** Raised when a provider is reachable but its answer cannot be trusted. */
export class QuizProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "no-key" | "network" | "rate-limit" | "bad-response" | "auth",
  ) {
    super(message);
    this.name = "QuizProviderError";
  }
}

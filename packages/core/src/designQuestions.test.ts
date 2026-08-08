import { beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "./db/executor.js";
import { migrate } from "./db/migrate.js";
import {
  createDesignQuestionsRepo,
  type DesignQuestionInput,
  gradeChoice,
} from "./db/repositories/designQuestions.js";
import { createDesignTopicsRepo } from "./db/repositories/designTopics.js";
import { createTestDb } from "./db/test-helpers.js";

const NOW = new Date("2026-08-01T09:00:00.000Z");

const CHOICE: DesignQuestionInput = {
  kind: "choice",
  prompt: "Which store fits the short-link mapping?",
  choices: ["A relational table", "A key-value store", "A message queue"],
  answerIndex: 1,
  modelAnswer: "Reads dominate and the access pattern is a single key lookup.",
};

const TEXT: DesignQuestionInput = {
  kind: "text",
  prompt: "How would you handle a hot key?",
  modelAnswer: "Cache in front, then shard the key space.",
};

let db: SqlExecutor;
let topicId: string;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
  const topic = await createDesignTopicsRepo(db).add(
    { title: "URL shortener", prompt: "", tags: [] },
    NOW,
  );
  topicId = topic.id;
});

describe("design questions repo", () => {
  it("stores a multiple-choice question with its options and answer", async () => {
    const repo = createDesignQuestionsRepo(db);
    const question = await repo.add(topicId, CHOICE, NOW);

    expect(question).toMatchObject({
      kind: "choice",
      choices: ["A relational table", "A key-value store", "A message queue"],
      answerIndex: 1,
      position: 0,
    });
  });

  it("stores a text question with no choices at all", async () => {
    const repo = createDesignQuestionsRepo(db);
    const question = await repo.add(topicId, TEXT, NOW);

    expect(question.kind).toBe("text");
    // The union means a reader never has to check whether choices are meaningful.
    expect("choices" in question).toBe(false);
  });

  it("keeps authored order", async () => {
    const repo = createDesignQuestionsRepo(db);
    await repo.add(topicId, CHOICE, NOW);
    await repo.add(topicId, TEXT, NOW);
    await repo.add(topicId, { ...TEXT, prompt: "Third" }, NOW);

    const questions = await repo.listByTopic(topicId);
    expect(questions.map((q) => q.position)).toEqual([0, 1, 2]);
    expect(questions.at(-1)?.prompt).toBe("Third");
  });

  it("converts a choice question to text and drops its options", async () => {
    const repo = createDesignQuestionsRepo(db);
    const question = await repo.add(topicId, CHOICE, NOW);

    const updated = await repo.update(question.id, TEXT);

    expect(updated.kind).toBe("text");
    // Leaving stale choices behind would resurrect them on a later edit.
    const row = await db.select<{ choices: string | null }>(
      "SELECT choices FROM design_questions WHERE id = ?",
      [question.id],
    );
    expect(row[0]?.choices).toBeNull();
  });

  it("deletes questions along with their topic", async () => {
    await createDesignQuestionsRepo(db).add(topicId, CHOICE, NOW);
    await createDesignTopicsRepo(db).remove(topicId);
    expect(await createDesignQuestionsRepo(db).listByTopic(topicId)).toEqual([]);
  });
});

/*
 * Validation lives in the repo, not only in the form, because Phase 16 writes here from a
 * model's output. A generated question with one option or an out-of-range answer would
 * otherwise be stored happily and only fail later, mid-review.
 */
describe("question validation", () => {
  it("rejects an empty prompt", async () => {
    const repo = createDesignQuestionsRepo(db);
    await expect(repo.add(topicId, { ...TEXT, prompt: "   " }, NOW)).rejects.toThrow(/prompt/i);
  });

  it("rejects a multiple-choice question with fewer than two real options", async () => {
    const repo = createDesignQuestionsRepo(db);
    await expect(
      repo.add(topicId, { ...CHOICE, choices: ["Only one", "  "], answerIndex: 0 }, NOW),
    ).rejects.toThrow(/two options/i);
  });

  it("rejects an answer index outside the options", async () => {
    const repo = createDesignQuestionsRepo(db);
    await expect(repo.add(topicId, { ...CHOICE, answerIndex: 7 }, NOW)).rejects.toThrow(
      /one of the options/i,
    );
  });
});

describe("gradeChoice", () => {
  it("marks the stored answer correct and everything else wrong", async () => {
    const question = await createDesignQuestionsRepo(db).add(topicId, CHOICE, NOW);

    expect(gradeChoice(question, 1)).toBe(true);
    expect(gradeChoice(question, 0)).toBe(false);
    expect(gradeChoice(question, null)).toBe(false);
  });

  it("never marks a text question correct — it has no gradeable answer", async () => {
    const question = await createDesignQuestionsRepo(db).add(topicId, TEXT, NOW);
    expect(gradeChoice(question, 0)).toBe(false);
  });
});

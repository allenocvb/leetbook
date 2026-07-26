import { beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "./db/executor.js";
import { migrate } from "./db/migrate.js";
import { createProblemsRepo } from "./db/repositories/problems.js";
import { createReviewsRepo } from "./db/repositories/reviews.js";
import { createSchedulingRepo } from "./db/repositories/scheduling.js";
import { createTestDb } from "./db/test-helpers.js";
import { applyReview, previewReview } from "./review.js";

const NOW = new Date("2026-07-25T12:00:00.000Z");

let db: SqlExecutor;
let problemId: string;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
  const problem = await createProblemsRepo(db).upsertBySlug(
    {
      slug: "two-sum",
      title: "Two Sum",
      url: "https://leetcode.com/problems/two-sum/",
      difficulty: "easy",
      tags: [],
    },
    NOW,
  );
  problemId = problem.id;
});

describe("applyReview", () => {
  it("appends to the review log and creates scheduling on first review", async () => {
    const { review, state } = await applyReview(db, { problemId, score: 4 }, NOW);

    expect(review.score).toBe(4);
    expect(state.reviewCount).toBe(1);
    expect(new Date(state.dueAt).getTime()).toBeGreaterThan(NOW.getTime());

    expect(await createReviewsRepo(db).listByProblem(problemId)).toHaveLength(1);
    expect(await createSchedulingRepo(db).get(problemId)).toEqual(state);
  });

  it("advances existing scheduling on subsequent reviews", async () => {
    const first = await applyReview(db, { problemId, score: 4 }, NOW);
    const later = new Date(first.state.dueAt);
    const second = await applyReview(db, { problemId, score: 5 }, later);

    expect(second.state.reviewCount).toBe(2);
    expect(await createReviewsRepo(db).listByProblem(problemId)).toHaveLength(2);
  });

  it("persists capture metadata when provided", async () => {
    await applyReview(
      db,
      {
        problemId,
        score: 3,
        runtimeMs: 61,
        memoryMb: 18.4,
        language: "python3",
        codeSnapshot: "x",
      },
      NOW,
    );
    const [review] = await createReviewsRepo(db).listByProblem(problemId);
    expect(review?.runtimeMs).toBe(61);
    expect(review?.codeSnapshot).toBe("x");
  });
});

describe("previewReview", () => {
  it("computes the next state without persisting anything", async () => {
    const preview = await previewReview(db, problemId, 5, NOW);
    expect(new Date(preview.dueAt).getTime()).toBeGreaterThan(NOW.getTime());
    expect(await createSchedulingRepo(db).get(problemId)).toBeNull();
    expect(await createReviewsRepo(db).listByProblem(problemId)).toHaveLength(0);
  });

  it("matches what applyReview would persist", async () => {
    const preview = await previewReview(db, problemId, 4, NOW);
    const { state } = await applyReview(db, { problemId, score: 4 }, NOW);
    expect(state.dueAt).toBe(preview.dueAt);
  });
});

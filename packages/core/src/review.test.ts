import { beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "./db/executor.js";
import { migrate } from "./db/migrate.js";
import { createProblemsRepo } from "./db/repositories/problems.js";
import { createReviewsRepo } from "./db/repositories/reviews.js";
import { createSchedulingRepo } from "./db/repositories/scheduling.js";
import { createTestDb } from "./db/test-helpers.js";
import { scheduleReview } from "./fsrs.js";
import { applyReview, correctLatestReview, previewReview, reviseLatestReview } from "./review.js";

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

describe("correctLatestReview", () => {
  it("changes only the latest score and rebuilds scheduling from the full history", async () => {
    const first = await applyReview(db, { problemId, score: 4 }, NOW);
    const later = new Date(first.state.dueAt);
    const second = await applyReview(
      db,
      {
        problemId,
        score: 5,
        runtimeMs: 61,
        memoryMb: 18.4,
        language: "python3",
        codeSnapshot: "snapshot",
      },
      later,
    );

    const corrected = await correctLatestReview(db, problemId, 0);
    const history = await createReviewsRepo(db).listByProblem(problemId);
    const expected = scheduleReview(scheduleReview(null, problemId, 4, NOW), problemId, 0, later);

    expect(history.map((review) => review.score)).toEqual([4, 0]);
    expect(history[0]?.id).toBe(first.review.id);
    expect(history[1]).toMatchObject({
      id: second.review.id,
      runtimeMs: 61,
      memoryMb: 18.4,
      language: "python3",
      codeSnapshot: "snapshot",
    });
    expect(corrected.review).toEqual(history[1]);
    expect(corrected.state).toEqual(expected);
    expect(corrected.state.reviewCount).toBe(2);
    expect(await createSchedulingRepo(db).get(problemId)).toEqual(expected);
  });

  it("rejects correction when no review exists", async () => {
    await expect(correctLatestReview(db, problemId, 3)).rejects.toThrow("without review history");
    expect(await createSchedulingRepo(db).get(problemId)).toBeNull();
  });
});

describe("reviseLatestReview", () => {
  it("moves the last review date and reschedules from it", async () => {
    await applyReview(db, { problemId, score: 4 }, new Date("2026-07-01T00:00:00.000Z"));
    const before = await createSchedulingRepo(db).get(problemId);

    const { review, state } = await reviseLatestReview(db, problemId, {
      reviewedAt: "2026-06-01T00:00:00.000Z",
    });

    expect(review.reviewedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(state.lastReviewedAt).toBe("2026-06-01T00:00:00.000Z");
    // An earlier review means an earlier due date; the score is untouched.
    expect(state.dueAt < (before?.dueAt ?? "")).toBe(true);
    expect(review.score).toBe(4);
  });

  it("overrides the rep count without inventing review rows", async () => {
    await applyReview(db, { problemId, score: 5 }, new Date("2026-07-01T00:00:00.000Z"));

    const { state } = await reviseLatestReview(db, problemId, { reviewCount: 6 });

    expect(state.reviewCount).toBe(6);
    // The log stays honest: one real review, six claimed reps, like a Notion import.
    expect(await createReviewsRepo(db).listByProblem(problemId)).toHaveLength(1);
  });

  it("re-sorts history when a date moves a review before an earlier one", async () => {
    await applyReview(db, { problemId, score: 2 }, new Date("2026-05-01T00:00:00.000Z"));
    await applyReview(db, { problemId, score: 5 }, new Date("2026-07-01T00:00:00.000Z"));

    // Drag the newest review back before the first one.
    const { state } = await reviseLatestReview(db, problemId, {
      reviewedAt: "2026-04-01T00:00:00.000Z",
    });

    // FSRS folded them in real chronological order, so the May review is now last.
    expect(state.lastReviewedAt).toBe("2026-05-01T00:00:00.000Z");
    expect(state.reviewCount).toBe(2);
  });

  it("changes score and date together", async () => {
    await applyReview(db, { problemId, score: 0 }, new Date("2026-07-01T00:00:00.000Z"));

    const { review } = await reviseLatestReview(db, problemId, {
      score: 5,
      reviewedAt: "2026-07-20T00:00:00.000Z",
    });

    expect(review).toMatchObject({ score: 5, reviewedAt: "2026-07-20T00:00:00.000Z" });
  });

  it("rejects an invalid date or a nonsense rep count", async () => {
    await applyReview(db, { problemId, score: 3 }, new Date("2026-07-01T00:00:00.000Z"));

    await expect(reviseLatestReview(db, problemId, { reviewedAt: "nope" })).rejects.toThrow(
      /valid date/,
    );
    await expect(reviseLatestReview(db, problemId, { reviewCount: 0 })).rejects.toThrow(
      /at least 1/,
    );
    await expect(reviseLatestReview(db, problemId, { reviewCount: 2.5 })).rejects.toThrow(/whole/);
  });
});

describe("reviseLatestReview rep-count preservation", () => {
  it("keeps an imported rep count when only the score changes", async () => {
    // Stands in for a Notion import: six claimed reps, one actual review row.
    await applyReview(db, { problemId, score: 3 }, new Date("2026-07-01T00:00:00.000Z"));
    const imported = await createSchedulingRepo(db).get(problemId);
    if (!imported) throw new Error("seed failed");
    await createSchedulingRepo(db).put({ ...imported, reviewCount: 6 });

    const { state } = await reviseLatestReview(db, problemId, { score: 5 });

    expect(state.reviewCount).toBe(6);
    expect(await createReviewsRepo(db).listByProblem(problemId)).toHaveLength(1);
  });

  it("still lets an explicit override win", async () => {
    await applyReview(db, { problemId, score: 3 }, new Date("2026-07-01T00:00:00.000Z"));
    const imported = await createSchedulingRepo(db).get(problemId);
    if (!imported) throw new Error("seed failed");
    await createSchedulingRepo(db).put({ ...imported, reviewCount: 6 });

    const { state } = await reviseLatestReview(db, problemId, { score: 5, reviewCount: 2 });
    expect(state.reviewCount).toBe(2);
  });
});

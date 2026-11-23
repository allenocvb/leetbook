import { beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "./db/executor.js";
import { migrate } from "./db/migrate.js";
import { createProblemsRepo } from "./db/repositories/problems.js";
import { createReviewsRepo } from "./db/repositories/reviews.js";
import { createSchedulingRepo } from "./db/repositories/scheduling.js";
import { createTestDb } from "./db/test-helpers.js";
import { recomputeSchedules } from "./recomputeSchedules.js";
import { scheduleReview } from "./schedule.js";

const LAST = "2026-11-21T21:07:34.932Z";

let db: SqlExecutor;
let problemId: string;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
  const problem = await createProblemsRepo(db).upsertBySlug(
    {
      slug: "binary-search",
      title: "Binary Search",
      url: "https://leetcode.com/problems/binary-search/",
      difficulty: "easy",
      tags: [],
    },
    new Date("2025-09-22T00:00:00.000Z"),
  );
  problemId = problem.id;
  const reviews = createReviewsRepo(db);
  for (const [score, reviewedAt] of [
    [2, "2026-07-26T17:48:19.886Z"],
    [5, LAST],
  ] as const) {
    await reviews.add({
      problemId,
      score,
      reviewedAt,
      runtimeMs: null,
      memoryMb: null,
      language: null,
      codeSnapshot: null,
    });
  }
});

function daysOut(dueAt: string): number {
  return (Date.parse(dueAt) - Date.parse(LAST)) / 86_400_000;
}

describe("recomputeSchedules", () => {
  it("rewrites an old FSRS due date with the formula, keeping the rep count", async () => {
    // Binary Search as FSRS left it: 4 reps, latest score 5, due 477 days out.
    await createSchedulingRepo(db).put({
      problemId,
      dueAt: "2028-03-12T21:07:34.932Z",
      reviewCount: 4,
      lastReviewedAt: LAST,
      fsrsCard: { stability: 477 },
    });

    expect(await recomputeSchedules(db)).toBe(1);
    const state = await createSchedulingRepo(db).get(problemId);
    expect(daysOut(state?.dueAt as string)).toBe(25); // round(5 × 1.5^4)
    expect(state?.reviewCount).toBe(4);
    expect(state?.lastReviewedAt).toBe(LAST);
  });

  it("is idempotent: a schedule that already agrees is left alone", async () => {
    await createSchedulingRepo(db).put({
      ...scheduleReview({ reviewCount: 1 } as never, problemId, 5, new Date(LAST)),
    });

    expect(await recomputeSchedules(db)).toBe(0);
    expect(await recomputeSchedules(db)).toBe(0);
  });
});

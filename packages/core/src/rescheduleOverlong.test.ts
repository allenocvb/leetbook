import { beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "./db/executor.js";
import { migrate } from "./db/migrate.js";
import { createProblemsRepo } from "./db/repositories/problems.js";
import { createReviewsRepo } from "./db/repositories/reviews.js";
import { createSchedulingRepo } from "./db/repositories/scheduling.js";
import { createTestDb } from "./db/test-helpers.js";
import { MAX_INTERVAL_DAYS, scheduleReview } from "./fsrs.js";
import { rescheduleOverlong } from "./rescheduleOverlong.js";

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
    [5, "2025-09-22T00:00:00.000Z"],
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

describe("rescheduleOverlong", () => {
  it("pulls a schedule written before the cap back inside it, keeping the rep count", async () => {
    const base = scheduleReview(null, problemId, 5, new Date(LAST));
    await createSchedulingRepo(db).put({
      ...base,
      dueAt: "2028-03-12T21:07:34.932Z",
      reviewCount: 4,
    });

    expect(await rescheduleOverlong(db)).toBe(1);
    const state = await createSchedulingRepo(db).get(problemId);
    expect(daysOut(state?.dueAt as string)).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
    expect(state?.reviewCount).toBe(4);
    expect(state?.lastReviewedAt).toBe(LAST);
  });

  it("leaves schedules inside the cap alone and is idempotent", async () => {
    const base = scheduleReview(null, problemId, 5, new Date(LAST));
    await createSchedulingRepo(db).put(base);

    expect(await rescheduleOverlong(db)).toBe(0);
    expect(await createSchedulingRepo(db).get(problemId)).toEqual(base);
  });
});

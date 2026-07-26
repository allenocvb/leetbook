import { beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "../db/executor.js";
import { migrate } from "../db/migrate.js";
import { createProblemsRepo } from "../db/repositories/problems.js";
import { createReviewsRepo } from "../db/repositories/reviews.js";
import { createSchedulingRepo } from "../db/repositories/scheduling.js";
import { createTestDb } from "../db/test-helpers.js";
import { scheduleReview } from "../fsrs.js";
import type { PerformanceScore } from "../scoring.js";
import { deriveStatus } from "./status.js";
import { listDueRows, listTableRows } from "./table.js";

const NOW = new Date("2026-07-25T12:00:00.000Z");

describe("deriveStatus", () => {
  it("is new with zero reviews", () => {
    expect(deriveStatus({ reviewCount: 0, latestScores: [], currentIntervalDays: 0 })).toBe("new");
  });

  it("is leech when the last two scores are both ≤ 1", () => {
    expect(deriveStatus({ reviewCount: 4, latestScores: [1, 0], currentIntervalDays: 2 })).toBe(
      "leech",
    );
  });

  it("is not leech after a single bad score", () => {
    expect(deriveStatus({ reviewCount: 4, latestScores: [1, 5], currentIntervalDays: 2 })).toBe(
      "learning",
    );
  });

  it("is mastered with ≥3 reviews, last score ≥4, interval ≥21 days", () => {
    expect(deriveStatus({ reviewCount: 3, latestScores: [5, 4], currentIntervalDays: 30 })).toBe(
      "mastered",
    );
  });

  it("is learning when interval is too short for mastered", () => {
    expect(deriveStatus({ reviewCount: 3, latestScores: [5, 4], currentIntervalDays: 10 })).toBe(
      "learning",
    );
  });
});

describe("table views", () => {
  let db: SqlExecutor;

  beforeEach(async () => {
    db = createTestDb();
    await migrate(db);
  });

  async function addProblem(slug: string, title: string, scores: PerformanceScore[], from: Date) {
    const problems = createProblemsRepo(db);
    const reviews = createReviewsRepo(db);
    const scheduling = createSchedulingRepo(db);
    const problem = await problems.upsertBySlug(
      { slug, title, url: `https://leetcode.com/problems/${slug}/`, difficulty: "easy", tags: [] },
      from,
    );
    let state = null;
    let at = from;
    for (const score of scores) {
      await reviews.add({
        problemId: problem.id,
        score,
        reviewedAt: at.toISOString(),
        runtimeMs: null,
        memoryMb: null,
        language: null,
        codeSnapshot: null,
      });
      state = scheduleReview(state, problem.id, score, at);
      at = new Date(state.dueAt);
    }
    if (state) await scheduling.put(state);
    return problem;
  }

  it("lists all problems with derived fields", async () => {
    await addProblem("two-sum", "Two Sum", [3, 5], new Date("2026-06-01T00:00:00.000Z"));
    await addProblem("lru-cache", "LRU Cache", [], NOW);

    const rows = await listTableRows(db);
    expect(rows.map((r) => r.title)).toEqual(["LRU Cache", "Two Sum"]);

    const lru = rows[0];
    expect(lru?.status).toBe("new");
    expect(lru?.nextReview).toBeNull();
    expect(lru?.reviewCount).toBe(0);

    const twoSum = rows[1];
    expect(twoSum?.status).not.toBe("new");
    expect(twoSum?.lastScore).toBe(5);
    expect(twoSum?.reviewCount).toBe(2);
    expect(twoSum?.nextReview).not.toBeNull();
  });

  it("due view returns only problems due by the given instant, soonest first", async () => {
    // reviewed long ago with a low score → due soon after
    await addProblem("old-fail", "Old Fail", [0], new Date("2026-01-01T00:00:00.000Z"));
    // reviewed recently with a high score → due far in the future
    await addProblem("fresh-ace", "Fresh Ace", [5], NOW);

    const due = await listDueRows(db, NOW.toISOString());
    expect(due.map((r) => r.slug)).toEqual(["old-fail"]);
  });

  it("problems without reviews never appear in the due view", async () => {
    await addProblem("untouched", "Untouched", [], NOW);
    expect(await listDueRows(db, NOW.toISOString())).toEqual([]);
  });
});

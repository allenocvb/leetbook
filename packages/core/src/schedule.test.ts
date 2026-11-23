import { describe, expect, it } from "vitest";
import { intervalDays, MAX_INTERVAL_DAYS, nextSchedule, scheduleReview } from "./schedule.js";
import type { PerformanceScore } from "./scoring.js";

const NOW = new Date("2026-07-25T12:00:00.000Z");

function daysUntilDue(dueAt: string, from: Date): number {
  return (new Date(dueAt).getTime() - from.getTime()) / 86_400_000;
}

describe("intervalDays — the Notion formula, round(score × 1.5^reps)", () => {
  // Every case below is a real row from the owner's Notion table: score, reps, then the
  // gap between its Last Review and Next Review dates.
  it.each([
    [5, 2, 11],
    [4, 2, 9],
    [5, 3, 17],
    [4, 3, 14],
    [5, 4, 25],
    [4, 4, 20],
    [3, 4, 15],
    [5, 5, 38],
    [4, 5, 30],
    [3, 5, 23],
    [5, 6, 57],
    [4, 6, 46],
    [3, 6, 34],
    [2, 6, 23],
    [3, 7, 51],
    [2, 2, 5],
  ] as const)("score %i at %i reps waits %i days", (score, reps, days) => {
    expect(intervalDays(score as PerformanceScore, reps)).toBe(days);
  });

  it("waits at least a day, even after a blackout", () => {
    expect(intervalDays(0, 1)).toBe(1);
    expect(intervalDays(0, 9)).toBe(1);
  });

  it("never waits longer than the maximum interval", () => {
    expect(intervalDays(5, 8)).toBe(MAX_INTERVAL_DAYS); // uncapped: 128
    expect(intervalDays(5, 30)).toBe(MAX_INTERVAL_DAYS);
  });
});

describe("scheduleReview", () => {
  it("first review counts as rep 1", () => {
    const state = scheduleReview(null, "p1", 5, NOW);
    expect(state.problemId).toBe("p1");
    expect(state.reviewCount).toBe(1);
    expect(state.lastReviewedAt).toBe(NOW.toISOString());
    expect(daysUntilDue(state.dueAt, NOW)).toBe(8); // round(5 × 1.5)
  });

  it("higher scores schedule further out", () => {
    const intervals = ([0, 2, 3, 4, 5] as PerformanceScore[]).map((score) =>
      daysUntilDue(scheduleReview(null, "p1", score, NOW).dueAt, NOW),
    );
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1] as number);
    }
  });

  it("grows gently through a run of perfect scores", () => {
    let state = scheduleReview(null, "p1", 5, NOW);
    const gaps = [daysUntilDue(state.dueAt, NOW)];
    for (let i = 0; i < 6; i++) {
      const at = new Date(state.dueAt);
      state = scheduleReview(state, "p1", 5, at);
      gaps.push(daysUntilDue(state.dueAt, at));
    }
    expect(gaps).toEqual([8, 11, 17, 25, 38, 57, 85]);
  });

  it("a weak score after a strong one pulls the next review in", () => {
    const first = scheduleReview({ problemId: "p1", reviewCount: 4 } as never, "p1", 5, NOW);
    const at = new Date(first.dueAt);
    const after = scheduleReview(first, "p1", 1, at);
    expect(daysUntilDue(after.dueAt, at)).toBeLessThan(daysUntilDue(first.dueAt, NOW));
  });

  it("continues from the stored rep count, which a Notion import can set", () => {
    const outcome = nextSchedule({ reviewCount: 3 }, 5, NOW);
    expect(outcome.reviewCount).toBe(4);
    expect(daysUntilDue(outcome.dueAt, NOW)).toBe(25);
  });

  it("is deterministic and round-trips through JSON", () => {
    const a = scheduleReview(null, "p1", 4, NOW);
    expect(scheduleReview(null, "p1", 4, NOW)).toEqual(a);
    const persisted = JSON.parse(JSON.stringify(a)) as typeof a;
    expect(scheduleReview(persisted, "p1", 4, new Date(a.dueAt)).reviewCount).toBe(2);
  });
});

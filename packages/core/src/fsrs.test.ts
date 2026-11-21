import { describe, expect, it } from "vitest";
import { MAX_INTERVAL_DAYS, scheduleReview } from "./fsrs.js";
import type { PerformanceScore } from "./scoring.js";

const NOW = new Date("2026-07-25T12:00:00.000Z");

function daysUntilDue(dueAt: string, from: Date): number {
  return (new Date(dueAt).getTime() - from.getTime()) / 86_400_000;
}

describe("scheduleReview", () => {
  it("first review produces a future due date and count of 1", () => {
    const state = scheduleReview(null, "p1", 5, NOW);
    expect(state.problemId).toBe("p1");
    expect(state.reviewCount).toBe(1);
    expect(state.lastReviewedAt).toBe(NOW.toISOString());
    expect(new Date(state.dueAt).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("higher scores schedule further out", () => {
    const intervals = ([0, 3, 4, 5] as PerformanceScore[]).map((score) =>
      daysUntilDue(scheduleReview(null, "p1", score, NOW).dueAt, NOW),
    );
    // again < hard < good < easy
    expect(intervals[0]).toBeLessThan(intervals[1] as number);
    expect(intervals[1]).toBeLessThan(intervals[2] as number);
    expect(intervals[2]).toBeLessThan(intervals[3] as number);
  });

  it("scores mapping to the same FSRS rating schedule identically (0–2 = again)", () => {
    const a = scheduleReview(null, "p1", 0, NOW);
    const b = scheduleReview(null, "p1", 2, NOW);
    expect(a.dueAt).toBe(b.dueAt);
  });

  it("an incorrect answer (score 2) never lengthens the interval of a learned problem", () => {
    let state = scheduleReview(null, "p1", 5, NOW);
    state = scheduleReview(state, "p1", 5, new Date(state.dueAt));
    const before = daysUntilDue(state.dueAt, new Date(state.lastReviewedAt as string));
    const at = new Date(state.dueAt);
    const after = daysUntilDue(scheduleReview(state, "p1", 2, at).dueAt, at);
    expect(after).toBeLessThan(before);
  });

  it("never schedules further out than the maximum interval", () => {
    // Binary Search, as it actually happened: an early 5, a slip, then a perfect review
    // after 112 days away. Uncapped FSRS put the next review 477 days out.
    const history: [PerformanceScore, string][] = [
      [5, "2025-09-22T00:00:00.000Z"],
      [2, "2026-07-26T17:48:19.886Z"],
      [4, "2026-08-01T19:25:24.609Z"],
      [5, "2026-11-21T21:07:34.932Z"],
    ];
    let state = null as ReturnType<typeof scheduleReview> | null;
    for (const [score, at] of history) state = scheduleReview(state, "p1", score, new Date(at));
    const last = new Date(history[3]?.[1] as string);
    expect(daysUntilDue(state?.dueAt as string, last)).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
  });

  it("is deterministic — same inputs, same output", () => {
    const a = scheduleReview(null, "p1", 5, NOW);
    const b = scheduleReview(null, "p1", 5, NOW);
    expect(a).toEqual(b);
  });

  it("round-trips through the serialized snapshot across multiple reviews", () => {
    const first = scheduleReview(null, "p1", 4, NOW);
    // simulate persistence: state comes back as parsed JSON (dates are strings)
    const persisted = JSON.parse(JSON.stringify(first)) as typeof first;

    const later = new Date(persisted.dueAt);
    const second = scheduleReview(persisted, "p1", 4, later);

    expect(second.reviewCount).toBe(2);
    expect(new Date(second.dueAt).getTime()).toBeGreaterThan(later.getTime());
    // successful recall grows the interval
    const firstInterval = daysUntilDue(first.dueAt, NOW);
    const secondInterval = daysUntilDue(second.dueAt, later);
    expect(secondInterval).toBeGreaterThan(firstInterval);
  });

  it("a failed review (score 0) shrinks the next interval", () => {
    const first = scheduleReview(null, "p1", 5, NOW);
    const later = new Date(first.dueAt);
    const failed = scheduleReview(first, "p1", 0, later);
    const goodInterval = daysUntilDue(first.dueAt, NOW);
    const failedInterval = daysUntilDue(failed.dueAt, later);
    expect(failedInterval).toBeLessThan(goodInterval);
  });

  it("does not mutate the input state", () => {
    const first = scheduleReview(null, "p1", 4, NOW);
    const frozen = JSON.stringify(first);
    scheduleReview(first, "p1", 0, new Date(first.dueAt));
    expect(JSON.stringify(first)).toBe(frozen);
  });
});

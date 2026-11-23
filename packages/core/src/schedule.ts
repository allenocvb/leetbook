import type { PerformanceScore } from "./scoring.js";
import type { FsrsCardSnapshot, SchedulingState } from "./types.js";

/**
 * LeetBook schedules with the formula from the owner's original Notion table:
 *
 *     next review = last review + round(score × 1.5^reps) days
 *
 * where `reps` counts this review. It grows gently — a run of perfect 5s comes back after
 * 8, 11, 17, 25, 38, 57, 85 days — and a weak score pulls the gap in proportionally. It
 * replaced FSRS, whose intervals jumped to years after a couple of easy reviews.
 *
 * Two guards the Notion formula did not need: a score of 0 still waits one day rather than
 * being due again immediately, and nothing is scheduled more than MAX_INTERVAL_DAYS out.
 */
export const GROWTH = 1.5;
export const MIN_INTERVAL_DAYS = 1;
/** Longest gap LeetBook will ever schedule. Interview prep wants a problem back within a season. */
export const MAX_INTERVAL_DAYS = 90;

const DAY_MS = 86_400_000;

/** Days until the next review after scoring `score` on the review numbered `reps`. */
export function intervalDays(score: PerformanceScore, reps: number): number {
  const raw = Math.round(score * GROWTH ** reps);
  return Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, raw));
}

/** Everything one review changes about a schedule. Deliberately carries no subject id. */
export interface ScheduleOutcome {
  dueAt: string;
  reviewCount: number;
  lastReviewedAt: string;
  /**
   * What the scheduler knew when it ran. The column is still named for FSRS, which this
   * replaced; a rename would be a migration for no behavioural gain.
   */
  fsrsCard: FsrsCardSnapshot;
}

/**
 * Advances a schedule by one review.
 *
 * The subject's identity plays no part in the calculation, so it is not a parameter. That
 * is what lets system design topics reuse this untouched.
 *
 * @param previous The schedule before this review (only its rep count matters), or null for a
 *   first-ever review.
 * @param score User-facing 0–5 recall score.
 * @param now Review timestamp.
 */
export function nextSchedule(
  previous: { reviewCount: number } | null,
  score: PerformanceScore,
  now: Date,
): ScheduleOutcome {
  const reps = (previous?.reviewCount ?? 0) + 1;
  const days = intervalDays(score, reps);
  return {
    dueAt: new Date(now.getTime() + days * DAY_MS).toISOString(),
    reviewCount: reps,
    lastReviewedAt: now.toISOString(),
    fsrsCard: { formula: "notion", score, reps, intervalDays: days },
  };
}

/**
 * Applies one review to a problem's scheduling state.
 *
 * @param state Current state, or null for a problem's first-ever review.
 * @param problemId The problem being reviewed.
 * @param score User-facing 0–5 recall score.
 * @param now Review timestamp.
 * @returns The next scheduling state (new object; input is not mutated).
 */
export function scheduleReview(
  state: SchedulingState | null,
  problemId: string,
  score: PerformanceScore,
  now: Date,
): SchedulingState {
  return { problemId, ...nextSchedule(state, score, now) };
}

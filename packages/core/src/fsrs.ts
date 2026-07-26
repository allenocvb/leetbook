import { type Card, createEmptyCard, fsrs, type Grade, generatorParameters, Rating } from "ts-fsrs";
import { type FsrsRating, mapScoreToRating, type PerformanceScore } from "./scoring.js";
import type { FsrsCardSnapshot, SchedulingState } from "./types.js";

const RATING: Record<FsrsRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

/**
 * - enable_fuzz: false → deterministic scheduling (testable, predictable).
 * - enable_short_term: false → no minutes-scale learning steps; LeetCode problems
 *   are reviewed on a scale of days, not Anki-style same-session repeats.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: false }));

/**
 * Applies one review to a problem's scheduling state.
 *
 * @param state Current state, or null for a problem's first-ever review.
 * @param problemId The problem being reviewed.
 * @param score User-facing 0–5 recall score (mapped internally to FSRS ratings).
 * @param now Review timestamp.
 * @returns The next scheduling state (new object; input is not mutated).
 */
export function scheduleReview(
  state: SchedulingState | null,
  problemId: string,
  score: PerformanceScore,
  now: Date,
): SchedulingState {
  const card = state === null ? createEmptyCard(now) : (state.fsrsCard as unknown as Card);
  const { card: next } = scheduler.next(card, now, RATING[mapScoreToRating(score)]);

  return {
    problemId,
    dueAt: new Date(next.due).toISOString(),
    reviewCount: next.reps,
    lastReviewedAt: now.toISOString(),
    fsrsCard: JSON.parse(JSON.stringify(next)) as FsrsCardSnapshot,
  };
}

import { type Card, createEmptyCard, fsrs, type Grade, generatorParameters, Rating } from "ts-fsrs";
import { type FsrsRating, mapScoreToRating, type PerformanceScore } from "./scoring.js";
import type { FsrsCardSnapshot, SchedulingState } from "./types.js";

const RATING: Record<FsrsRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

/** Longest gap LeetBook will ever schedule. Interview prep wants a problem back within a season. */
export const MAX_INTERVAL_DAYS = 90;
const DAY_MS = 86_400_000;

/**
 * - enable_fuzz: false → deterministic scheduling (testable, predictable).
 * - enable_short_term: false → no minutes-scale learning steps; LeetCode problems
 *   are reviewed on a scale of days, not Anki-style same-session repeats.
 * - request_retention 0.93 (FSRS default 0.9): a little more frequent than flashcard decks,
 *   because recalling a whole solution is harder than recalling a fact.
 * - maximum_interval: FSRS defaults to 100 years, which put a twice-perfect problem 477 days
 *   out. Capped so nothing drifts out of rotation.
 */
const scheduler = fsrs(
  generatorParameters({
    enable_fuzz: false,
    enable_short_term: false,
    request_retention: 0.93,
    maximum_interval: MAX_INTERVAL_DAYS,
  }),
);

/** Everything one review changes about a schedule. Deliberately carries no subject id. */
export interface ScheduleOutcome {
  dueAt: string;
  reviewCount: number;
  lastReviewedAt: string;
  fsrsCard: FsrsCardSnapshot;
}

/**
 * Advances a schedule by one review.
 *
 * The subject's identity plays no part in the calculation — FSRS sees a card, a rating and a
 * clock — so it is not a parameter. That is what lets system design topics reuse this untouched
 * rather than growing a parallel scheduler that would drift out of agreement over time.
 *
 * @param card Current FSRS card, or null for a first-ever review.
 * @param score User-facing 0–5 recall score (mapped internally to FSRS ratings).
 * @param now Review timestamp.
 */
export function nextSchedule(
  card: FsrsCardSnapshot | null,
  score: PerformanceScore,
  now: Date,
): ScheduleOutcome {
  const current = card === null ? createEmptyCard(now) : (card as unknown as Card);
  const { card: next } = scheduler.next(current, now, RATING[mapScoreToRating(score)]);

  // ts-fsrs can overshoot maximum_interval by a day or two, so enforce the cap here too.
  const latest = now.getTime() + MAX_INTERVAL_DAYS * DAY_MS;
  if (new Date(next.due).getTime() > latest) {
    next.due = new Date(latest);
    next.scheduled_days = MAX_INTERVAL_DAYS;
  }

  return {
    dueAt: new Date(next.due).toISOString(),
    reviewCount: next.reps,
    lastReviewedAt: now.toISOString(),
    fsrsCard: JSON.parse(JSON.stringify(next)) as FsrsCardSnapshot,
  };
}

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
  return { problemId, ...nextSchedule(state?.fsrsCard ?? null, score, now) };
}

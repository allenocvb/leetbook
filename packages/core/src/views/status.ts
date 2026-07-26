/**
 * Derived problem status — computed at read time, never stored.
 *
 * - new:      never reviewed
 * - leech:    keeps failing — the last two scores were both ≤ 1 (needs re-study, not scheduling)
 * - mastered: at least 3 reviews, latest score ≥ 4, and the current interval is ≥ 21 days
 * - learning: everything else
 */
export type ProblemStatus = "new" | "learning" | "mastered" | "leech";

export interface StatusInput {
  reviewCount: number;
  /** Most recent first. Only the last few are needed. */
  latestScores: readonly number[];
  /** Days between the last review and the next due date. */
  currentIntervalDays: number;
}

const MASTERED_MIN_REVIEWS = 3;
const MASTERED_MIN_SCORE = 4;
const MASTERED_MIN_INTERVAL_DAYS = 21;
const LEECH_MAX_SCORE = 1;

export function deriveStatus(input: StatusInput): ProblemStatus {
  const { reviewCount, latestScores, currentIntervalDays } = input;
  if (reviewCount === 0) return "new";

  const [last, previous] = latestScores;
  if (
    last !== undefined &&
    previous !== undefined &&
    last <= LEECH_MAX_SCORE &&
    previous <= LEECH_MAX_SCORE
  ) {
    return "leech";
  }

  if (
    reviewCount >= MASTERED_MIN_REVIEWS &&
    last !== undefined &&
    last >= MASTERED_MIN_SCORE &&
    currentIntervalDays >= MASTERED_MIN_INTERVAL_DAYS
  ) {
    return "mastered";
  }

  return "learning";
}

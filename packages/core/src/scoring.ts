/**
 * LeetBook's user-facing recall rubric (carried over from the original Notion table):
 *
 * 0 — Complete blackout, couldn't recall approach or solution
 * 1 — Incorrect, but the approach felt familiar once seen
 * 2 — Incorrect, but knew the general approach after a hint
 * 3 — Correct, but with significant effort or struggle
 * 4 — Correct after some hesitation or minor stumbling
 * 5 — Perfect recall, solved smoothly and confidently
 */
export type PerformanceScore = 0 | 1 | 2 | 3 | 4 | 5;

/** FSRS's four-point rating scale. */
export type FsrsRating = "again" | "hard" | "good" | "easy";

/**
 * Maps the 0–5 performance score onto FSRS ratings.
 * The UX stays 0–5; the scheduler speaks FSRS.
 *
 * The split follows the rubric's own line: 0–2 are incorrect solutions, so they lapse
 * (Again); 3–5 are correct, graded by effort. Mapping 2 to Hard used to *lengthen* the
 * interval after a wrong answer, and 3 and 4 used to schedule identically.
 */
export function mapScoreToRating(score: PerformanceScore): FsrsRating {
  switch (score) {
    case 0:
    case 1:
    case 2:
      return "again";
    case 3:
      return "hard";
    case 4:
      return "good";
    case 5:
      return "easy";
  }
}

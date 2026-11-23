import type { SqlExecutor } from "./db/executor.js";
import { createReviewsRepo, type ReviewInput } from "./db/repositories/reviews.js";
import { createSchedulingRepo } from "./db/repositories/scheduling.js";
import { nextSchedule, scheduleReview } from "./schedule.js";
import type { PerformanceScore } from "./scoring.js";
import type { Review, SchedulingState } from "./types.js";

export interface ApplyReviewInput {
  problemId: string;
  score: PerformanceScore;
  /** Submission stats when the review came from a capture; null for in-app ratings. */
  runtimeMs?: number | null;
  memoryMb?: number | null;
  language?: string | null;
  codeSnapshot?: string | null;
}

export interface ApplyReviewResult {
  review: Review;
  state: SchedulingState;
}

export interface CorrectLatestReviewResult {
  review: Review;
  state: SchedulingState;
}

/**
 * The one write path for "the user reviewed a problem": appends to the
 * review log and advances FSRS scheduling. Used by the in-app review
 * session and by extension captures alike.
 */
export async function applyReview(
  db: SqlExecutor,
  input: ApplyReviewInput,
  now: Date,
): Promise<ApplyReviewResult> {
  const reviews = createReviewsRepo(db);
  const scheduling = createSchedulingRepo(db);

  const reviewInput: ReviewInput = {
    problemId: input.problemId,
    score: input.score,
    reviewedAt: now.toISOString(),
    runtimeMs: input.runtimeMs ?? null,
    memoryMb: input.memoryMb ?? null,
    language: input.language ?? null,
    codeSnapshot: input.codeSnapshot ?? null,
  };

  const current = await scheduling.get(input.problemId);
  const state = scheduleReview(current, input.problemId, input.score, now);

  const review = await reviews.add(reviewInput);
  await scheduling.put(state);
  return { review, state };
}

/** Preview of where a score would schedule the problem, without persisting. */
export async function previewReview(
  db: SqlExecutor,
  problemId: string,
  score: PerformanceScore,
  now: Date,
): Promise<SchedulingState> {
  const current = await createSchedulingRepo(db).get(problemId);
  return scheduleReview(current, problemId, score, now);
}

export interface ReviseLatestReviewInput {
  score?: PerformanceScore;
  /** ISO timestamp. May move the review before earlier ones; history is re-sorted. */
  reviewedAt?: string;
  /**
   * Explicit rep-count override. `reviewCount` is stored FSRS state rather than a count of
   * rows — the Notion import already sets it from a CSV column while writing a single
   * review — so a user correcting an imported total is not fighting the data model.
   */
  reviewCount?: number;
}

/**
 * Corrects the most recent review — score, date, or both — then rebuilds FSRS from the
 * complete review history. Earlier reviews and capture metadata stay intact.
 */
export async function correctLatestReview(
  db: SqlExecutor,
  problemId: string,
  score: PerformanceScore,
): Promise<CorrectLatestReviewResult> {
  return reviseLatestReview(db, problemId, { score });
}

export async function reviseLatestReview(
  db: SqlExecutor,
  problemId: string,
  input: ReviseLatestReviewInput,
): Promise<CorrectLatestReviewResult> {
  const reviews = createReviewsRepo(db);
  const history = await reviews.listByProblem(problemId);
  const latest = history.at(-1);
  if (!latest) throw new Error("Cannot correct a problem without review history.");

  if (input.reviewedAt !== undefined && Number.isNaN(Date.parse(input.reviewedAt))) {
    throw new Error("Last review date is not a valid date.");
  }
  if (
    input.reviewCount !== undefined &&
    (!Number.isInteger(input.reviewCount) || input.reviewCount < 1)
  ) {
    throw new Error("Review count must be a whole number of at least 1.");
  }

  const corrected: Review = {
    ...latest,
    score: input.score ?? latest.score,
    reviewedAt: input.reviewedAt ?? latest.reviewedAt,
  };

  // Re-sort: a new date can move this review before earlier ones, so "latest" is whichever
  // review now comes last.
  const revised = [...history.slice(0, -1), corrected].sort((a, b) =>
    a.reviewedAt.localeCompare(b.reviewedAt),
  );
  const last = revised.at(-1) as Review;

  /*
   * Keep the stored rep count unless the user overrode it. It can legitimately exceed the
   * number of review rows — an imported Notion problem carries six reps and one review — and
   * the formula's interval depends on it, so it is the count, not the row total, that counts.
   */
  const existing = await createSchedulingRepo(db).get(problemId);
  const reviewCount = input.reviewCount ?? existing?.reviewCount ?? revised.length;
  const state: SchedulingState = {
    problemId,
    ...nextSchedule({ reviewCount: reviewCount - 1 }, last.score, new Date(last.reviewedAt)),
  };

  await reviews.revise(latest.id, { score: input.score, reviewedAt: input.reviewedAt });
  await createSchedulingRepo(db).put(state);
  return { review: corrected, state };
}

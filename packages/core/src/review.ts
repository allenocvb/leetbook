import type { SqlExecutor } from "./db/executor.js";
import { createReviewsRepo, type ReviewInput } from "./db/repositories/reviews.js";
import { createSchedulingRepo } from "./db/repositories/scheduling.js";
import { scheduleReview } from "./fsrs.js";
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

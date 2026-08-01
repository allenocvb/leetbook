import type { SqlExecutor } from "./db/executor.js";
import {
  createDesignReviewsRepo,
  createDesignSchedulingRepo,
} from "./db/repositories/designReviews.js";
import { nextSchedule } from "./fsrs.js";
import type { PerformanceScore } from "./scoring.js";
import type { DesignReview, DesignSchedulingState } from "./types.js";

export interface ApplyDesignReviewResult {
  review: DesignReview;
  state: DesignSchedulingState;
}

/**
 * The one write path for "the user reviewed a design topic": appends to the review log and
 * advances the schedule.
 *
 * Deliberately the same shape as `applyReview`, and deliberately calling the same
 * `nextSchedule`. A second scheduler tuned separately for design would drift out of agreement
 * with the first, and two subtly different notions of "due" is worse than none.
 */
export async function applyDesignReview(
  db: SqlExecutor,
  input: { topicId: string; score: PerformanceScore },
  now: Date,
): Promise<ApplyDesignReviewResult> {
  const reviews = createDesignReviewsRepo(db);
  const scheduling = createDesignSchedulingRepo(db);

  const current = await scheduling.get(input.topicId);
  const state: DesignSchedulingState = {
    topicId: input.topicId,
    ...nextSchedule(current?.fsrsCard ?? null, input.score, now),
  };

  const review = await reviews.add({
    topicId: input.topicId,
    score: input.score,
    reviewedAt: now.toISOString(),
  });
  await scheduling.put(state);
  return { review, state };
}

/** Where a score would schedule the topic, without persisting anything. */
export async function previewDesignReview(
  db: SqlExecutor,
  topicId: string,
  score: PerformanceScore,
  now: Date,
): Promise<DesignSchedulingState> {
  const current = await createDesignSchedulingRepo(db).get(topicId);
  return { topicId, ...nextSchedule(current?.fsrsCard ?? null, score, now) };
}

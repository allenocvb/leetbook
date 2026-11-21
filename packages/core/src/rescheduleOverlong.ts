import type { SqlExecutor } from "./db/executor.js";
import { createDesignSchedulingRepo } from "./db/repositories/designReviews.js";
import { createSchedulingRepo } from "./db/repositories/scheduling.js";
import { MAX_INTERVAL_DAYS, nextSchedule, type ScheduleOutcome } from "./fsrs.js";
import type { PerformanceScore } from "./scoring.js";

const OVERLONG = `julianday(due_at) - julianday(last_reviewed_at) > ${MAX_INTERVAL_DAYS} + 1`;

/** Folds a review history through the current scheduler. */
function replay(history: { score: number; reviewed_at: string }[]): ScheduleOutcome | null {
  let outcome: ScheduleOutcome | null = null;
  for (const review of history) {
    outcome = nextSchedule(
      outcome?.fsrsCard ?? null,
      review.score as PerformanceScore,
      new Date(review.reviewed_at),
    );
  }
  return outcome;
}

/**
 * Re-folds the history of anything scheduled further out than the scheduler now allows.
 *
 * Schedules written before the maximum interval existed can sit years away. Only those rows
 * are touched, and afterwards they fall inside the cap, so this is idempotent and cheap enough
 * to run every boot. The stored rep count is kept: it can legitimately exceed the number of
 * review rows (a Notion import carries its count but one review).
 *
 * @returns How many problems and design topics were rescheduled.
 */
export async function rescheduleOverlong(db: SqlExecutor): Promise<number> {
  let changed = 0;

  const problems = await db.select<{ problem_id: string; review_count: number }>(
    `SELECT problem_id, review_count FROM scheduling WHERE ${OVERLONG}`,
  );
  for (const row of problems) {
    const history = await db.select<{ score: number; reviewed_at: string }>(
      "SELECT score, reviewed_at FROM reviews WHERE problem_id = ? ORDER BY reviewed_at",
      [row.problem_id],
    );
    const outcome = replay(history);
    if (!outcome) continue;
    await createSchedulingRepo(db).put({
      problemId: row.problem_id,
      ...outcome,
      reviewCount: row.review_count,
    });
    changed += 1;
  }

  const topics = await db.select<{ topic_id: string; review_count: number }>(
    `SELECT topic_id, review_count FROM design_scheduling WHERE ${OVERLONG}`,
  );
  for (const row of topics) {
    const history = await db.select<{ score: number; reviewed_at: string }>(
      "SELECT score, reviewed_at FROM design_reviews WHERE topic_id = ? ORDER BY reviewed_at",
      [row.topic_id],
    );
    const outcome = replay(history);
    if (!outcome) continue;
    await createDesignSchedulingRepo(db).put({
      topicId: row.topic_id,
      ...outcome,
      reviewCount: row.review_count,
    });
    changed += 1;
  }

  return changed;
}

import type { SqlExecutor } from "./db/executor.js";
import { intervalDays } from "./schedule.js";
import type { PerformanceScore } from "./scoring.js";

const DAY_MS = 86_400_000;

interface Row {
  id: string;
  due_at: string;
  review_count: number;
  last_reviewed_at: string | null;
  score: number | null;
}

/**
 * Brings every stored due date in line with the current formula: last review plus
 * `intervalDays(latest score, rep count)`.
 *
 * Schedules written by the old FSRS scheduler (or by a Notion import) can disagree with
 * that. Only rows that differ are rewritten, and a rewritten row then agrees, so this is
 * idempotent and cheap enough to run every boot.
 *
 * @returns How many problems and design topics were rescheduled.
 */
export async function recomputeSchedules(db: SqlExecutor): Promise<number> {
  const problems = await db.select<Row>(
    `SELECT s.problem_id AS id, s.due_at, s.review_count, s.last_reviewed_at,
            (SELECT score FROM reviews r WHERE r.problem_id = s.problem_id
              ORDER BY r.reviewed_at DESC LIMIT 1) AS score
       FROM scheduling s`,
  );
  const topics = await db.select<Row>(
    `SELECT s.topic_id AS id, s.due_at, s.review_count, s.last_reviewed_at,
            (SELECT score FROM design_reviews r WHERE r.topic_id = s.topic_id
              ORDER BY r.reviewed_at DESC LIMIT 1) AS score
       FROM design_scheduling s`,
  );

  let changed = 0;
  changed += await rewrite(db, problems, "scheduling", "problem_id");
  changed += await rewrite(db, topics, "design_scheduling", "topic_id");
  return changed;
}

async function rewrite(
  db: SqlExecutor,
  rows: Row[],
  table: "scheduling" | "design_scheduling",
  key: "problem_id" | "topic_id",
): Promise<number> {
  let changed = 0;
  for (const row of rows) {
    if (row.score === null || !row.last_reviewed_at) continue;
    const reps = Math.max(1, row.review_count);
    const days = intervalDays(row.score as PerformanceScore, reps);
    const dueAt = new Date(Date.parse(row.last_reviewed_at) + days * DAY_MS).toISOString();
    if (dueAt === row.due_at) continue;

    const card = { formula: "notion", score: row.score, reps, intervalDays: days };
    await db.execute(`UPDATE ${table} SET due_at = ?, fsrs_card = ? WHERE ${key} = ?`, [
      dueAt,
      JSON.stringify(card),
      row.id,
    ]);
    changed += 1;
  }
  return changed;
}

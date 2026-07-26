import type { SchedulingState } from "../../types.js";
import type { SqlExecutor } from "../executor.js";
import { type SchedulingRow, toSchedulingState } from "../rows.js";

export interface SchedulingRepo {
  get(problemId: string): Promise<SchedulingState | null>;
  /** Insert or replace the state for a problem. */
  put(state: SchedulingState): Promise<void>;
  /** All states due at or before the given instant, soonest first. */
  listDueBy(instant: string): Promise<SchedulingState[]>;
}

export function createSchedulingRepo(db: SqlExecutor): SchedulingRepo {
  return {
    async get(problemId) {
      const rows = await db.select<SchedulingRow>("SELECT * FROM scheduling WHERE problem_id = ?", [
        problemId,
      ]);
      return rows[0] ? toSchedulingState(rows[0]) : null;
    },

    async put(state) {
      await db.execute(
        `INSERT INTO scheduling (problem_id, due_at, review_count, last_reviewed_at, fsrs_card)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (problem_id) DO UPDATE SET
           due_at = excluded.due_at,
           review_count = excluded.review_count,
           last_reviewed_at = excluded.last_reviewed_at,
           fsrs_card = excluded.fsrs_card`,
        [
          state.problemId,
          state.dueAt,
          state.reviewCount,
          state.lastReviewedAt,
          JSON.stringify(state.fsrsCard),
        ],
      );
    },

    async listDueBy(instant) {
      const rows = await db.select<SchedulingRow>(
        "SELECT * FROM scheduling WHERE due_at <= ? ORDER BY due_at",
        [instant],
      );
      return rows.map(toSchedulingState);
    },
  };
}

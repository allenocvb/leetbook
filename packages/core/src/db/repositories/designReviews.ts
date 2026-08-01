import type { DesignReview, DesignSchedulingState } from "../../types.js";
import type { SqlExecutor } from "../executor.js";
import {
  type DesignReviewRow,
  type DesignSchedulingRow,
  toDesignReview,
  toDesignSchedulingState,
} from "../rows.js";

export type DesignReviewInput = Omit<DesignReview, "id">;

export interface DesignReviewsRepo {
  /** Append a review. Normal review entry never updates or deletes history. */
  add(input: DesignReviewInput): Promise<DesignReview>;
  listByTopic(topicId: string): Promise<DesignReview[]>;
}

export function createDesignReviewsRepo(db: SqlExecutor): DesignReviewsRepo {
  return {
    async add(input) {
      const id = crypto.randomUUID();
      await db.execute(
        "INSERT INTO design_reviews (id, topic_id, score, reviewed_at) VALUES (?, ?, ?, ?)",
        [id, input.topicId, input.score, input.reviewedAt],
      );
      return { id, ...input };
    },

    async listByTopic(topicId) {
      const rows = await db.select<DesignReviewRow>(
        "SELECT * FROM design_reviews WHERE topic_id = ? ORDER BY reviewed_at",
        [topicId],
      );
      return rows.map(toDesignReview);
    },
  };
}

export interface DesignSchedulingRepo {
  get(topicId: string): Promise<DesignSchedulingState | null>;
  put(state: DesignSchedulingState): Promise<void>;
  /** All states due at or before the given instant, soonest first. */
  listDueBy(instant: string): Promise<DesignSchedulingState[]>;
}

export function createDesignSchedulingRepo(db: SqlExecutor): DesignSchedulingRepo {
  return {
    async get(topicId) {
      const rows = await db.select<DesignSchedulingRow>(
        "SELECT * FROM design_scheduling WHERE topic_id = ?",
        [topicId],
      );
      return rows[0] ? toDesignSchedulingState(rows[0]) : null;
    },

    async put(state) {
      await db.execute(
        `INSERT INTO design_scheduling (topic_id, due_at, review_count, last_reviewed_at, fsrs_card)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (topic_id) DO UPDATE SET
           due_at = excluded.due_at,
           review_count = excluded.review_count,
           last_reviewed_at = excluded.last_reviewed_at,
           fsrs_card = excluded.fsrs_card`,
        [
          state.topicId,
          state.dueAt,
          state.reviewCount,
          state.lastReviewedAt,
          JSON.stringify(state.fsrsCard),
        ],
      );
    },

    async listDueBy(instant) {
      const rows = await db.select<DesignSchedulingRow>(
        "SELECT * FROM design_scheduling WHERE due_at <= ? ORDER BY due_at",
        [instant],
      );
      return rows.map(toDesignSchedulingState);
    },
  };
}

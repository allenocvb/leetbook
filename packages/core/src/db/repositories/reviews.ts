import type { Review } from "../../types.js";
import type { SqlExecutor } from "../executor.js";
import { type ReviewRow, toReview } from "../rows.js";

export type ReviewInput = Omit<Review, "id">;

export interface ReviewsRepo {
  /** Append a review. The log is append-only: no update or delete exists on purpose. */
  add(input: ReviewInput): Promise<Review>;
  listByProblem(problemId: string): Promise<Review[]>;
  /** Most recent first. */
  latestScores(problemId: string, limit: number): Promise<number[]>;
}

export function createReviewsRepo(db: SqlExecutor): ReviewsRepo {
  return {
    async add(input) {
      const id = crypto.randomUUID();
      await db.execute(
        `INSERT INTO reviews (id, problem_id, score, reviewed_at, runtime_ms, memory_mb, language, code_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.problemId,
          input.score,
          input.reviewedAt,
          input.runtimeMs,
          input.memoryMb,
          input.language,
          input.codeSnapshot,
        ],
      );
      return { id, ...input };
    },

    async listByProblem(problemId) {
      const rows = await db.select<ReviewRow>(
        "SELECT * FROM reviews WHERE problem_id = ? ORDER BY reviewed_at",
        [problemId],
      );
      return rows.map(toReview);
    },

    async latestScores(problemId, limit) {
      const rows = await db.select<{ score: number }>(
        "SELECT score FROM reviews WHERE problem_id = ? ORDER BY reviewed_at DESC LIMIT ?",
        [problemId, limit],
      );
      return rows.map((r) => r.score);
    },
  };
}

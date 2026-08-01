import type { SqlExecutor } from "../db/executor.js";
import type { IsoDateTime } from "../types.js";
import { deriveStatus, type ProblemStatus } from "./status.js";

/**
 * One row of the System design table. Everything here is derived at read time.
 *
 * Shaped like `TableRow` minus the LeetCode-only fields, so the desktop table can render both
 * without a second row component. `deriveStatus` is shared outright: "mastered" means the same
 * thing for a design topic as for a problem — reviewed enough times, recently, and holding.
 */
export interface DesignTableRow {
  topicId: string;
  title: string;
  prompt: string;
  tags: string[];
  status: ProblemStatus;
  nextReview: IsoDateTime | null;
  lastReview: IsoDateTime | null;
  lastScore: number | null;
  reviewCount: number;
}

interface JoinedRow {
  id: string;
  title: string;
  prompt: string;
  tags: string;
  due_at: string | null;
  last_reviewed_at: string | null;
  review_count: number | null;
  last_score: number | null;
  prev_score: number | null;
}

const JOINED_SELECT = `
  SELECT
    t.id, t.title, t.prompt, t.tags,
    s.due_at, s.last_reviewed_at, s.review_count,
    (SELECT r.score FROM design_reviews r WHERE r.topic_id = t.id
      ORDER BY r.reviewed_at DESC LIMIT 1) AS last_score,
    (SELECT r.score FROM design_reviews r WHERE r.topic_id = t.id
      ORDER BY r.reviewed_at DESC LIMIT 1 OFFSET 1) AS prev_score
  FROM design_topics t
  LEFT JOIN design_scheduling s ON s.topic_id = t.id
`;

/** All design topics, ordered by title. */
export async function listDesignTableRows(db: SqlExecutor): Promise<DesignTableRow[]> {
  const rows = await db.select<JoinedRow>(`${JOINED_SELECT} ORDER BY t.title`);
  return rows.map(toDesignTableRow);
}

/** Design topics due at or before `instant`, soonest first. */
export async function listDueDesignRows(
  db: SqlExecutor,
  instant: IsoDateTime,
): Promise<DesignTableRow[]> {
  const rows = await db.select<JoinedRow>(
    `${JOINED_SELECT} WHERE s.due_at IS NOT NULL AND s.due_at <= ? ORDER BY s.due_at`,
    [instant],
  );
  return rows.map(toDesignTableRow);
}

function toDesignTableRow(row: JoinedRow): DesignTableRow {
  const intervalDays =
    row.due_at && row.last_reviewed_at
      ? (new Date(row.due_at).getTime() - new Date(row.last_reviewed_at).getTime()) / 86_400_000
      : 0;

  const latestScores: number[] = [];
  if (row.last_score !== null) latestScores.push(row.last_score);
  if (row.prev_score !== null) latestScores.push(row.prev_score);

  return {
    topicId: row.id,
    title: row.title,
    prompt: row.prompt,
    tags: JSON.parse(row.tags) as string[],
    status: deriveStatus({
      reviewCount: row.review_count ?? 0,
      latestScores,
      currentIntervalDays: intervalDays,
    }),
    nextReview: row.due_at,
    lastReview: row.last_reviewed_at,
    lastScore: row.last_score,
    reviewCount: row.review_count ?? 0,
  };
}

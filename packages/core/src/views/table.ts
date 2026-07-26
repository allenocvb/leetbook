import type { SqlExecutor } from "../db/executor.js";
import type { Difficulty, IsoDateTime } from "../types.js";
import { deriveStatus, type ProblemStatus } from "./status.js";

/** One row of the All Problems / Due Today table. Everything here is derived. */
export interface TableRow {
  problemId: string;
  slug: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  tags: string[];
  status: ProblemStatus;
  nextReview: IsoDateTime | null;
  lastReview: IsoDateTime | null;
  lastScore: number | null;
  reviewCount: number;
}

interface JoinedRow {
  id: string;
  slug: string;
  title: string;
  url: string;
  difficulty: string;
  tags: string;
  due_at: string | null;
  last_reviewed_at: string | null;
  review_count: number | null;
  last_score: number | null;
  prev_score: number | null;
}

const JOINED_SELECT = `
  SELECT
    p.id, p.slug, p.title, p.url, p.difficulty, p.tags,
    s.due_at, s.last_reviewed_at, s.review_count,
    (SELECT r.score FROM reviews r WHERE r.problem_id = p.id
      ORDER BY r.reviewed_at DESC LIMIT 1) AS last_score,
    (SELECT r.score FROM reviews r WHERE r.problem_id = p.id
      ORDER BY r.reviewed_at DESC LIMIT 1 OFFSET 1) AS prev_score
  FROM problems p
  LEFT JOIN scheduling s ON s.problem_id = p.id
`;

/** All problems, ordered by title. */
export async function listTableRows(db: SqlExecutor): Promise<TableRow[]> {
  const rows = await db.select<JoinedRow>(`${JOINED_SELECT} ORDER BY p.title`);
  return rows.map(toTableRow);
}

/** Problems due at or before `instant`, soonest first. */
export async function listDueRows(db: SqlExecutor, instant: IsoDateTime): Promise<TableRow[]> {
  const rows = await db.select<JoinedRow>(
    `${JOINED_SELECT} WHERE s.due_at IS NOT NULL AND s.due_at <= ? ORDER BY s.due_at`,
    [instant],
  );
  return rows.map(toTableRow);
}

function toTableRow(row: JoinedRow): TableRow {
  const intervalDays =
    row.due_at && row.last_reviewed_at
      ? (new Date(row.due_at).getTime() - new Date(row.last_reviewed_at).getTime()) / 86_400_000
      : 0;

  const latestScores: number[] = [];
  if (row.last_score !== null) latestScores.push(row.last_score);
  if (row.prev_score !== null) latestScores.push(row.prev_score);

  return {
    problemId: row.id,
    slug: row.slug,
    title: row.title,
    url: row.url,
    difficulty: row.difficulty as Difficulty,
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

import type { SqlExecutor } from "../db/executor.js";
import {
  type NoteRow,
  type ProblemRow,
  type ReviewRow,
  type SchedulingRow,
  toNote,
  toProblem,
  toReview,
  toSchedulingState,
} from "../db/rows.js";
import type { Note, Problem, Review, SchedulingState } from "../types.js";

export interface DatabaseExport {
  format: "leetbook";
  version: 1;
  exportedAt: string;
  problems: Problem[];
  reviews: Review[];
  scheduling: SchedulingState[];
  notes: Note[];
}

/** Full-database snapshot as a portable JSON string (backup / migration). */
export async function exportDatabaseJson(db: SqlExecutor, now: Date): Promise<string> {
  const [problems, reviews, scheduling, notes] = await Promise.all([
    db.select<ProblemRow>("SELECT * FROM problems ORDER BY slug"),
    db.select<ReviewRow>("SELECT * FROM reviews ORDER BY reviewed_at, id"),
    db.select<SchedulingRow>("SELECT * FROM scheduling ORDER BY problem_id"),
    db.select<NoteRow>("SELECT * FROM notes ORDER BY problem_id"),
  ]);

  const payload: DatabaseExport = {
    format: "leetbook",
    version: 1,
    exportedAt: now.toISOString(),
    problems: problems.map(toProblem),
    reviews: reviews.map(toReview),
    scheduling: scheduling.map(toSchedulingState),
    notes: notes.map(toNote),
  };
  return JSON.stringify(payload, null, 2);
}

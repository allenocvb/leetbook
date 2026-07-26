import type { Note } from "../../types.js";
import type { SqlExecutor } from "../executor.js";
import { type NoteRow, toNote } from "../rows.js";

export interface NotesRepo {
  get(problemId: string): Promise<Note | null>;
  /** Insert or replace the note for a problem. */
  put(problemId: string, contentJson: string, now: Date): Promise<Note>;
}

export function createNotesRepo(db: SqlExecutor): NotesRepo {
  return {
    async get(problemId) {
      const rows = await db.select<NoteRow>("SELECT * FROM notes WHERE problem_id = ?", [
        problemId,
      ]);
      return rows[0] ? toNote(rows[0]) : null;
    },

    async put(problemId, contentJson, now) {
      const updatedAt = now.toISOString();
      await db.execute(
        `INSERT INTO notes (problem_id, content_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT (problem_id) DO UPDATE SET
           content_json = excluded.content_json,
           updated_at = excluded.updated_at`,
        [problemId, contentJson, updatedAt],
      );
      return { problemId, contentJson, updatedAt };
    },
  };
}

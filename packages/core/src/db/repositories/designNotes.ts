import type { DesignNote } from "../../types.js";
import type { SqlExecutor } from "../executor.js";
import { type DesignNoteRow, toDesignNote } from "../rows.js";

export interface DesignNotesRepo {
  get(topicId: string): Promise<DesignNote | null>;
  /** Insert or replace the note for a topic. */
  put(topicId: string, contentJson: string, now: Date): Promise<DesignNote>;
}

export function createDesignNotesRepo(db: SqlExecutor): DesignNotesRepo {
  return {
    async get(topicId) {
      const rows = await db.select<DesignNoteRow>("SELECT * FROM design_notes WHERE topic_id = ?", [
        topicId,
      ]);
      return rows[0] ? toDesignNote(rows[0]) : null;
    },

    async put(topicId, contentJson, now) {
      const updatedAt = now.toISOString();
      await db.execute(
        `INSERT INTO design_notes (topic_id, content_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT (topic_id) DO UPDATE SET
           content_json = excluded.content_json,
           updated_at = excluded.updated_at`,
        [topicId, contentJson, updatedAt],
      );
      return { topicId, contentJson, updatedAt };
    },
  };
}

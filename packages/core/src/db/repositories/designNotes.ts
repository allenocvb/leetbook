import type { DesignNote } from "../../types.js";
import type { SqlExecutor } from "../executor.js";
import { type DesignNoteRow, toDesignNote } from "../rows.js";

export interface DesignNotesRepo {
  get(topicId: string): Promise<DesignNote | null>;
  /** Insert or replace the prose for a topic, leaving any diagram untouched. */
  put(topicId: string, contentJson: string, now: Date): Promise<DesignNote>;
  /** Insert or replace the diagram for a topic, leaving the prose untouched. */
  putScene(topicId: string, sceneJson: string | null, now: Date): Promise<DesignNote>;
}

/**
 * Prose and diagram share a row but are written independently.
 *
 * Both autosave, and they autosave at different moments — typing a paragraph must not
 * overwrite a diagram drawn a second earlier, and vice versa. Each writer therefore names
 * only its own column in the ON CONFLICT clause, so the other keeps whatever is stored.
 */
export function createDesignNotesRepo(db: SqlExecutor): DesignNotesRepo {
  const read = async (topicId: string): Promise<DesignNote> => {
    const rows = await db.select<DesignNoteRow>("SELECT * FROM design_notes WHERE topic_id = ?", [
      topicId,
    ]);
    const row = rows[0];
    if (!row) throw new Error(`design note for "${topicId}" was not stored`);
    return toDesignNote(row);
  };

  return {
    async get(topicId) {
      const rows = await db.select<DesignNoteRow>("SELECT * FROM design_notes WHERE topic_id = ?", [
        topicId,
      ]);
      return rows[0] ? toDesignNote(rows[0]) : null;
    },

    async put(topicId, contentJson, now) {
      await db.execute(
        `INSERT INTO design_notes (topic_id, content_json, scene_json, updated_at)
         VALUES (?, ?, NULL, ?)
         ON CONFLICT (topic_id) DO UPDATE SET
           content_json = excluded.content_json,
           updated_at = excluded.updated_at`,
        [topicId, contentJson, now.toISOString()],
      );
      return read(topicId);
    },

    async putScene(topicId, sceneJson, now) {
      // Empty prose on insert: a topic may be diagrammed before a word is written.
      await db.execute(
        `INSERT INTO design_notes (topic_id, content_json, scene_json, updated_at)
         VALUES (?, '', ?, ?)
         ON CONFLICT (topic_id) DO UPDATE SET
           scene_json = excluded.scene_json,
           updated_at = excluded.updated_at`,
        [topicId, sceneJson, now.toISOString()],
      );
      return read(topicId);
    },
  };
}

import type { DesignTopic } from "../../types.js";
import type { SqlExecutor } from "../executor.js";
import { type DesignTopicRow, toDesignTopic } from "../rows.js";

export interface DesignTopicInput {
  title: string;
  prompt: string;
  tags: string[];
}

export interface DesignTopicsRepo {
  add(input: DesignTopicInput, now: Date): Promise<DesignTopic>;
  update(id: string, input: DesignTopicInput): Promise<DesignTopic>;
  getById(id: string): Promise<DesignTopic | null>;
  listAll(): Promise<DesignTopic[]>;
  /** Permanently remove a topic and everything derived from it. */
  remove(id: string): Promise<void>;
}

/**
 * Tidies free-form tags without imposing a vocabulary.
 *
 * LeetCode categories are a closed canonical list because free typing produced duplicates.
 * System design has no equivalent agreed taxonomy, and inventing one here would be a guess
 * baked into the schema — so tags stay open, and this only removes the failure the canonical
 * list was introduced to fix: the same tag stored twice under different spelling or spacing.
 * First spelling wins, and the user's ordering is preserved.
 */
export function normalizeTopicTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim().replace(/\s+/g, " ");
    if (trimmed === "") continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function createDesignTopicsRepo(db: SqlExecutor): DesignTopicsRepo {
  return {
    async add(input, now) {
      const id = crypto.randomUUID();
      await db.execute(
        `INSERT INTO design_topics (id, title, prompt, tags, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          id,
          input.title.trim(),
          input.prompt,
          JSON.stringify(normalizeTopicTags(input.tags)),
          now.toISOString(),
        ],
      );
      const stored = await this.getById(id);
      if (!stored) throw new Error(`design topic "${id}" was not stored`);
      return stored;
    },

    async update(id, input) {
      await db.execute("UPDATE design_topics SET title = ?, prompt = ?, tags = ? WHERE id = ?", [
        input.title.trim(),
        input.prompt,
        JSON.stringify(normalizeTopicTags(input.tags)),
        id,
      ]);
      const stored = await this.getById(id);
      if (!stored) throw new Error(`design topic "${id}" was not found`);
      return stored;
    },

    async getById(id) {
      const rows = await db.select<DesignTopicRow>("SELECT * FROM design_topics WHERE id = ?", [
        id,
      ]);
      return rows[0] ? toDesignTopic(rows[0]) : null;
    },

    async listAll() {
      const rows = await db.select<DesignTopicRow>("SELECT * FROM design_topics ORDER BY title");
      return rows.map(toDesignTopic);
    },

    /*
     * Children deleted explicitly rather than via ON DELETE CASCADE, for the same reason as
     * problems: SQLite only enforces foreign keys when `PRAGMA foreign_keys = ON`, and the
     * desktop connection does not set it. Relying on the cascade would silently orphan rows.
     */
    async remove(id) {
      await db.execute("DELETE FROM design_notes WHERE topic_id = ?", [id]);
      await db.execute("DELETE FROM design_scheduling WHERE topic_id = ?", [id]);
      await db.execute("DELETE FROM design_reviews WHERE topic_id = ?", [id]);
      await db.execute("DELETE FROM design_topics WHERE id = ?", [id]);
    },
  };
}

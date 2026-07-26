import type { Problem } from "../../types.js";
import type { SqlExecutor } from "../executor.js";
import { type ProblemRow, toProblem } from "../rows.js";

export interface ProblemInput {
  slug: string;
  title: string;
  url: string;
  difficulty: Problem["difficulty"];
  tags: string[];
}

export interface ProblemsRepo {
  /** Insert, or update metadata if the slug already exists. Returns the stored problem. */
  upsertBySlug(input: ProblemInput, now: Date): Promise<Problem>;
  /** Update editable metadata while preserving the problem id and all related history. */
  update(id: string, input: ProblemInput): Promise<Problem>;
  getBySlug(slug: string): Promise<Problem | null>;
  getById(id: string): Promise<Problem | null>;
  listAll(): Promise<Problem[]>;
  /** Permanently remove a problem and everything derived from it. */
  remove(id: string): Promise<void>;
}

export function createProblemsRepo(db: SqlExecutor): ProblemsRepo {
  return {
    async upsertBySlug(input, now) {
      await db.execute(
        `INSERT INTO problems (id, slug, title, url, difficulty, tags, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (slug) DO UPDATE SET
           title = excluded.title,
           url = excluded.url,
           difficulty = excluded.difficulty,
           tags = excluded.tags`,
        [
          crypto.randomUUID(),
          input.slug,
          input.title,
          input.url,
          input.difficulty,
          JSON.stringify(input.tags),
          now.toISOString(),
        ],
      );
      const stored = await this.getBySlug(input.slug);
      if (!stored) throw new Error(`upsert failed for slug "${input.slug}"`);
      return stored;
    },

    async update(id, input) {
      await db.execute(
        `UPDATE problems
         SET slug = ?, title = ?, url = ?, difficulty = ?, tags = ?
         WHERE id = ?`,
        [input.slug, input.title, input.url, input.difficulty, JSON.stringify(input.tags), id],
      );
      const stored = await this.getById(id);
      if (!stored) throw new Error(`problem "${id}" was not found`);
      return stored;
    },

    async getBySlug(slug) {
      const rows = await db.select<ProblemRow>("SELECT * FROM problems WHERE slug = ?", [slug]);
      return rows[0] ? toProblem(rows[0]) : null;
    },

    async getById(id) {
      const rows = await db.select<ProblemRow>("SELECT * FROM problems WHERE id = ?", [id]);
      return rows[0] ? toProblem(rows[0]) : null;
    },

    async listAll() {
      const rows = await db.select<ProblemRow>("SELECT * FROM problems ORDER BY title");
      return rows.map(toProblem);
    },

    /*
     * Children are deleted explicitly rather than left to ON DELETE CASCADE. SQLite
     * enforces foreign keys only when `PRAGMA foreign_keys = ON` is set on the
     * connection, and the desktop app does not set it — relying on the cascade there
     * would silently orphan reviews, scheduling and notes. Deleting oldest-dependent
     * first keeps this correct whether or not enforcement is on.
     */
    async remove(id) {
      await db.execute("DELETE FROM notes WHERE problem_id = ?", [id]);
      await db.execute("DELETE FROM scheduling WHERE problem_id = ?", [id]);
      await db.execute("DELETE FROM reviews WHERE problem_id = ?", [id]);
      await db.execute("DELETE FROM problems WHERE id = ?", [id]);
    },
  };
}

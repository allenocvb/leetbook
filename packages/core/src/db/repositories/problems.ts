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
  getBySlug(slug: string): Promise<Problem | null>;
  getById(id: string): Promise<Problem | null>;
  listAll(): Promise<Problem[]>;
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
  };
}

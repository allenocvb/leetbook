export interface Migration {
  /** Sequential, starting at 1. Never reuse or reorder. */
  version: number;
  name: string;
  /** Statements executed in order, inside the runner's transaction discipline. */
  statements: readonly string[];
}

/**
 * Forward-only migrations. Rules:
 * - Never edit a shipped migration — add a new one.
 * - Derived data (status, due-ness) is never stored; these tables are the source of truth.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "initial-schema",
    statements: [
      `CREATE TABLE problems (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE reviews (
        id TEXT PRIMARY KEY,
        problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
        score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 5),
        reviewed_at TEXT NOT NULL,
        runtime_ms INTEGER,
        memory_mb REAL,
        language TEXT,
        code_snapshot TEXT
      )`,
      `CREATE INDEX idx_reviews_problem_id ON reviews(problem_id)`,
      `CREATE TABLE scheduling (
        problem_id TEXT PRIMARY KEY REFERENCES problems(id) ON DELETE CASCADE,
        due_at TEXT NOT NULL,
        review_count INTEGER NOT NULL DEFAULT 0,
        last_reviewed_at TEXT,
        fsrs_card TEXT NOT NULL
      )`,
      `CREATE INDEX idx_scheduling_due_at ON scheduling(due_at)`,
      `CREATE TABLE notes (
        problem_id TEXT PRIMARY KEY REFERENCES problems(id) ON DELETE CASCADE,
        content_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    name: "design-topics",
    /*
     * System design gets its own tables rather than extra columns on `problems`.
     * A design topic has no slug, URL, difficulty, runtime or language, and folding it in
     * would put six permanently-null columns on every LeetCode row and a "which kind is
     * this?" check on every query. The schedule is the only thing the two genuinely share,
     * and that is shared through `nextSchedule`, not through a table.
     */
    statements: [
      `CREATE TABLE design_topics (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE design_reviews (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL REFERENCES design_topics(id) ON DELETE CASCADE,
        score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 5),
        reviewed_at TEXT NOT NULL
      )`,
      `CREATE INDEX idx_design_reviews_topic_id ON design_reviews(topic_id)`,
      `CREATE TABLE design_scheduling (
        topic_id TEXT PRIMARY KEY REFERENCES design_topics(id) ON DELETE CASCADE,
        due_at TEXT NOT NULL,
        review_count INTEGER NOT NULL DEFAULT 0,
        last_reviewed_at TEXT,
        fsrs_card TEXT NOT NULL
      )`,
      `CREATE INDEX idx_design_scheduling_due_at ON design_scheduling(due_at)`,
      `CREATE TABLE design_notes (
        topic_id TEXT PRIMARY KEY REFERENCES design_topics(id) ON DELETE CASCADE,
        content_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 3,
    name: "design-canvas",
    /*
     * The diagram lives beside the prose, not in it. An Excalidraw scene is a flat list of
     * elements plus view state — a different shape from a ProseMirror document, and one the
     * editor would have to treat as an opaque blob anyway. A separate nullable column keeps
     * both readable, and lets a topic have notes without a diagram or the reverse.
     *
     * Added as its own migration rather than folded into version 2, which has shipped.
     */
    statements: ["ALTER TABLE design_notes ADD COLUMN scene_json TEXT"],
  },
];

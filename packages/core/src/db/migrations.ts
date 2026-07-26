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
];

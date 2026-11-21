import {
  createProblemsRepo,
  createReviewsRepo,
  createSchedulingRepo,
  migrate,
  type PerformanceScore,
  type SqlExecutor,
  scheduleReview,
} from "@leetbook/core";
import { createTestDb } from "@leetbook/core/testing";

/*
 * Every database opened by a test, so they can all be closed afterwards.
 *
 * `node:sqlite` handles are native and are not reclaimed by garbage collection. Left open
 * they keep the worker alive, and once enough have accumulated the run simply stops making
 * progress — no failure, no output, every file still passing in isolation. That symptom was
 * misread twice before the cause was found here.
 */
const openDatabases: { close: () => void }[] = [];

/** Real in-memory SQLite database with migrations applied. Closed after each test. */
export async function makeDb(): Promise<SqlExecutor> {
  const db = createTestDb();
  openDatabases.push(db.raw);
  await migrate(db);
  return db;
}

/** Registered as an `afterEach` in `test-setup.ts`. */
export function closeTestDatabases(): void {
  for (const db of openDatabases.splice(0)) {
    try {
      db.close();
    } catch {
      // Already closed, or never fully opened; either way there is nothing to reclaim.
    }
  }
}

export interface SeedProblem {
  slug: string;
  title: string;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
  /** Chronological scores; scheduling follows the formula from the first date. */
  scores?: PerformanceScore[];
  firstReviewedAt?: string;
}

export async function seed(db: SqlExecutor, problems: SeedProblem[]): Promise<void> {
  const problemsRepo = createProblemsRepo(db);
  const reviewsRepo = createReviewsRepo(db);
  const schedulingRepo = createSchedulingRepo(db);

  for (const spec of problems) {
    const problem = await problemsRepo.upsertBySlug(
      {
        slug: spec.slug,
        title: spec.title,
        url: `https://leetcode.com/problems/${spec.slug}/`,
        difficulty: spec.difficulty ?? "easy",
        tags: spec.tags ?? [],
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    let state = null;
    let at = new Date(spec.firstReviewedAt ?? "2026-01-01T00:00:00.000Z");
    for (const score of spec.scores ?? []) {
      await reviewsRepo.add({
        problemId: problem.id,
        score,
        reviewedAt: at.toISOString(),
        runtimeMs: null,
        memoryMb: null,
        language: null,
        codeSnapshot: null,
      });
      state = scheduleReview(state, problem.id, score, at);
      at = new Date(state.dueAt);
    }
    if (state) await schedulingRepo.put(state);
  }
}

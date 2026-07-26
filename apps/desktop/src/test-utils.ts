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

/** Real in-memory SQLite database with migrations applied. */
export async function makeDb(): Promise<SqlExecutor> {
  const db = createTestDb();
  await migrate(db);
  return db;
}

export interface SeedProblem {
  slug: string;
  title: string;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
  /** Chronological scores; scheduling follows FSRS from the first date. */
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

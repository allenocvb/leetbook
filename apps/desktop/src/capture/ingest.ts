import {
  applyReview,
  createProblemsRepo,
  isDifficulty,
  isPerformanceScore,
  type SqlExecutor,
} from "@leetbook/core";

export type IngestResult =
  | { ok: true; slug: string; title: string; reviewedAt: string }
  | { ok: false; error: string };

/**
 * Applies one extension capture: upserts the problem, appends the review with
 * submission metadata, and advances FSRS scheduling. The payload arrives as
 * JSON via the Rust listener's `leetbook://capture` event.
 */
export async function ingestCapture(
  db: SqlExecutor,
  payloadJson: string,
  now: Date,
): Promise<IngestResult> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "payload is not valid JSON" };
  }

  const slug = typeof payload.slug === "string" ? payload.slug : "";
  const title = typeof payload.title === "string" ? payload.title : "";
  const difficulty = payload.difficulty;
  const score = payload.score;

  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, error: `invalid slug "${slug}"` };
  if (title === "") return { ok: false, error: "missing title" };
  if (!isDifficulty(difficulty)) return { ok: false, error: "invalid difficulty" };
  if (!isPerformanceScore(score)) return { ok: false, error: "invalid score" };

  const problem = await createProblemsRepo(db).upsertBySlug(
    {
      slug,
      title,
      url: `https://leetcode.com/problems/${slug}/`,
      difficulty,
      tags: Array.isArray(payload.tags) ? payload.tags.filter((t) => typeof t === "string") : [],
    },
    now,
  );

  await applyReview(
    db,
    {
      problemId: problem.id,
      score,
      runtimeMs: typeof payload.runtimeMs === "number" ? payload.runtimeMs : null,
      memoryMb: typeof payload.memoryMb === "number" ? payload.memoryMb : null,
      language: typeof payload.language === "string" ? payload.language : null,
      codeSnapshot: typeof payload.codeSnapshot === "string" ? payload.codeSnapshot : null,
    },
    now,
  );

  return { ok: true, slug, title, reviewedAt: now.toISOString() };
}

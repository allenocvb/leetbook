import type { SqlExecutor } from "../db/executor.js";
import { createProblemsRepo } from "../db/repositories/problems.js";
import { createReviewsRepo } from "../db/repositories/reviews.js";
import { createSchedulingRepo } from "../db/repositories/scheduling.js";
import { scheduleReview } from "../fsrs.js";
import { isPerformanceScore } from "../types.js";
import { parseCsvWithHeader } from "./csv.js";

export interface NotionImportResult {
  imported: number;
  skipped: { line: number; title: string; reason: string }[];
}

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

/** Parses Notion's "October 15, 2025" format as UTC midnight. Returns null if invalid. */
export function parseNotionDate(value: string): Date | null {
  const match = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = MONTHS[(match[1] as string).toLowerCase()];
  if (month === undefined) return null;
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[2])));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Extracts the problem slug from any leetcode.com/problems/<slug>/... URL. */
export function slugFromUrl(url: string): string | null {
  const match = /leetcode\.com\/problems\/([a-z0-9-]+)/i.exec(url);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * Imports a Notion "LeetCode Problems Auto" CSV export.
 *
 * For each row: upserts the problem; if it has review history (score + last review
 * date), appends one synthetic review and reconstructs an FSRS state seeded from that
 * review — preserving the user's existing Next Review date and review count rather
 * than FSRS's opinion, so imported schedules aren't disrupted.
 */
export async function importNotionCsv(
  db: SqlExecutor,
  csvText: string,
  now: Date,
): Promise<NotionImportResult> {
  const problems = createProblemsRepo(db);
  const reviews = createReviewsRepo(db);
  const scheduling = createSchedulingRepo(db);
  const result: NotionImportResult = { imported: 0, skipped: [] };

  const records = parseCsvWithHeader(csvText);
  for (let i = 0; i < records.length; i++) {
    const record = records[i] as Record<string, string>;
    const line = i + 2; // 1-based, after header
    const title = record.Name ?? "";

    const slug = slugFromUrl(record.URL ?? "");
    if (!slug) {
      result.skipped.push({ line, title, reason: "missing or invalid LeetCode URL" });
      continue;
    }
    const difficulty = (record.Difficulty ?? "").toLowerCase();
    if (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard") {
      result.skipped.push({ line, title, reason: `unknown difficulty "${record.Difficulty}"` });
      continue;
    }

    const problem = await problems.upsertBySlug(
      {
        slug,
        title: title || slug,
        url: `https://leetcode.com/problems/${slug}/`,
        difficulty,
        tags: record.Category ? [record.Category] : [],
      },
      now,
    );

    const lastReview = parseNotionDate(record["Last Review Date"] ?? "");
    const score = Number(record["Performance Score"]);
    if (lastReview && isPerformanceScore(score)) {
      await reviews.add({
        problemId: problem.id,
        score,
        reviewedAt: lastReview.toISOString(),
        runtimeMs: null,
        memoryMb: null,
        language: null,
        codeSnapshot: null,
      });

      const seeded = scheduleReview(null, problem.id, score, lastReview);
      const nextReview = parseNotionDate(record["Next Review"] ?? "");
      const reviewCount = Number.parseInt(record["Review Count"] ?? "", 10);
      await scheduling.put({
        ...seeded,
        dueAt: nextReview ? nextReview.toISOString() : seeded.dueAt,
        reviewCount: Number.isFinite(reviewCount) && reviewCount > 0 ? reviewCount : 1,
      });
    }

    result.imported++;
  }
  return result;
}

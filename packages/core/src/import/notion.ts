import type { SqlExecutor } from "../db/executor.js";
import { createProblemsRepo } from "../db/repositories/problems.js";
import { createReviewsRepo } from "../db/repositories/reviews.js";
import { createSchedulingRepo } from "../db/repositories/scheduling.js";
import { scheduleReview } from "../fsrs.js";
import type { Problem, SchedulingState } from "../types.js";
import { isPerformanceScore } from "../types.js";
import { parseCsvWithHeader } from "./csv.js";

export interface NotionImportIssue {
  line: number;
  title: string;
  reason: string;
}

export interface NotionImportResult {
  totalRows: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: NotionImportIssue[];
  warnings: NotionImportIssue[];
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
  const year = Number(match[3]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(year, month, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Extracts the problem slug from any leetcode.com/problems/<slug>/... URL. */
export function slugFromUrl(url: string): string | null {
  const match = /leetcode\.com\/problems\/([a-z0-9-]+)/i.exec(url);
  return match?.[1]?.toLowerCase() ?? null;
}

function sameProblemMetadata(
  problem: Problem,
  input: Pick<Problem, "slug" | "title" | "url" | "difficulty" | "tags">,
): boolean {
  return (
    problem.slug === input.slug &&
    problem.title === input.title &&
    problem.url === input.url &&
    problem.difficulty === input.difficulty &&
    problem.tags.length === input.tags.length &&
    problem.tags.every((tag, index) => tag === input.tags[index])
  );
}

function sameScheduling(left: SchedulingState | null, right: SchedulingState): boolean {
  return (
    left?.dueAt === right.dueAt &&
    left.reviewCount === right.reviewCount &&
    left.lastReviewedAt === right.lastReviewedAt &&
    JSON.stringify(left.fsrsCard) === JSON.stringify(right.fsrsCard)
  );
}

/**
 * Imports a Notion "LeetCode Problems Auto" CSV export.
 *
 * For each valid row: upserts problem metadata and reconstructs an FSRS state from
 * the latest Notion review snapshot. Existing snapshots are not duplicated, and
 * newer or conflicting local review history wins over imported scheduling.
 */
export async function importNotionCsv(
  db: SqlExecutor,
  csvText: string,
  now: Date,
): Promise<NotionImportResult> {
  const problems = createProblemsRepo(db);
  const reviews = createReviewsRepo(db);
  const scheduling = createSchedulingRepo(db);
  const records = parseCsvWithHeader(csvText);
  const result: NotionImportResult = {
    totalRows: records.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: [],
    warnings: [],
  };
  const seenSlugs = new Map<string, number>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i] as Record<string, string>;
    const line = i + 2; // 1-based, after header
    const title = record.Name ?? "";

    const slug = slugFromUrl(record.URL ?? "");
    if (!slug) {
      result.skipped.push({ line, title, reason: "missing or invalid LeetCode URL" });
      continue;
    }
    const normalizedDifficulty = (record.Difficulty ?? "").toLowerCase();
    if (
      normalizedDifficulty !== "easy" &&
      normalizedDifficulty !== "medium" &&
      normalizedDifficulty !== "hard"
    ) {
      result.skipped.push({ line, title, reason: `unknown difficulty "${record.Difficulty}"` });
      continue;
    }
    const difficulty: Problem["difficulty"] = normalizedDifficulty;
    const firstLine = seenSlugs.get(slug);
    if (firstLine !== undefined) {
      result.skipped.push({
        line,
        title,
        reason: `duplicate LeetCode problem in this CSV (first seen on line ${firstLine})`,
      });
      continue;
    }
    seenSlugs.set(slug, line);

    const input = {
      slug,
      title: title || slug,
      url: `https://leetcode.com/problems/${slug}/`,
      difficulty,
      tags: record.Category ? [record.Category] : [],
    };
    const existing = await problems.getBySlug(slug);
    let changed = existing ? !sameProblemMetadata(existing, input) : true;
    const problem = await problems.upsertBySlug(input, now);
    const existingReviews = existing ? await reviews.listByProblem(existing.id) : [];
    const existingSchedule = existing ? await scheduling.get(existing.id) : null;

    const lastReview = parseNotionDate(record["Last Review Date"] ?? "");
    const scoreValue = record["Performance Score"] ?? "";
    const score = Number(scoreValue);
    if (lastReview && scoreValue.trim() !== "" && isPerformanceScore(score)) {
      const reviewedAt = lastReview.toISOString();
      const exactReviewExists = existingReviews.some(
        (review) => review.reviewedAt === reviewedAt && review.score === score,
      );
      const conflictingReviewExists = existingReviews.some(
        (review) => review.reviewedAt === reviewedAt && review.score !== score,
      );
      const newerLocalReviewExists = existingReviews.some(
        (review) => review.reviewedAt > reviewedAt,
      );
      if (!exactReviewExists && !conflictingReviewExists) {
        await reviews.add({
          problemId: problem.id,
          score,
          reviewedAt,
          runtimeMs: null,
          memoryMb: null,
          language: null,
          codeSnapshot: null,
        });
        changed = true;
      }
      if (conflictingReviewExists) {
        result.warnings.push({
          line,
          title,
          reason:
            "a local review already exists at this time with a different score; kept local data",
        });
      }

      const seeded = scheduleReview(null, problem.id, score, lastReview);
      const nextReviewValue = record["Next Review"] ?? "";
      const nextReview = parseNotionDate(nextReviewValue);
      const reviewCount = Number.parseInt(record["Review Count"] ?? "", 10);
      const importedSchedule = {
        ...seeded,
        dueAt: nextReview ? nextReview.toISOString() : seeded.dueAt,
        reviewCount: Number.isFinite(reviewCount) && reviewCount > 0 ? reviewCount : 1,
      };
      if (
        !newerLocalReviewExists &&
        !conflictingReviewExists &&
        !sameScheduling(existingSchedule, importedSchedule)
      ) {
        await scheduling.put(importedSchedule);
        changed = true;
      }
      if (nextReviewValue.trim() !== "" && !nextReview) {
        result.warnings.push({
          line,
          title,
          reason: "invalid Next Review date; used the FSRS fallback",
        });
      }
      if (
        (record["Review Count"] ?? "").trim() !== "" &&
        (!Number.isFinite(reviewCount) || reviewCount <= 0)
      ) {
        result.warnings.push({
          line,
          title,
          reason: "invalid Review Count; defaulted to 1",
        });
      }
    } else if ((record["Last Review Date"] ?? "").trim() !== "" || scoreValue.trim() !== "") {
      result.warnings.push({
        line,
        title,
        reason: "review snapshot ignored; it needs a valid date and score from 0–5",
      });
    }

    if (!existing) result.created++;
    else if (changed) result.updated++;
    else result.unchanged++;
  }
  return result;
}

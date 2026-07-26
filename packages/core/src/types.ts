import type { PerformanceScore } from "./scoring.js";

/** ISO 8601 UTC timestamp, e.g. "2026-07-25T14:30:00.000Z". */
export type IsoDateTime = string;

export type Difficulty = "easy" | "medium" | "hard";

/** A LeetCode problem the user has practiced (or plans to). */
export interface Problem {
  id: string;
  /** LeetCode slug, e.g. "two-sum". Unique. */
  slug: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  /** Topic tags, e.g. ["Array", "Hash Table"]. */
  tags: string[];
  createdAt: IsoDateTime;
}

/** One practice attempt. Appended normally; only the latest score may be explicitly corrected. */
export interface Review {
  id: string;
  problemId: string;
  score: PerformanceScore;
  reviewedAt: IsoDateTime;
  /** Submission stats, when captured by the extension. */
  runtimeMs: number | null;
  memoryMb: number | null;
  language: string | null;
  codeSnapshot: string | null;
}

/**
 * Opaque FSRS card snapshot, persisted as JSON. Only the FSRS wrapper
 * (fsrs.ts) reads or writes its internals — everyone else treats it as a token.
 */
export type FsrsCardSnapshot = Record<string, unknown>;

/** Current scheduling state for one problem. Queryable fields + opaque card. */
export interface SchedulingState {
  problemId: string;
  dueAt: IsoDateTime;
  reviewCount: number;
  lastReviewedAt: IsoDateTime | null;
  fsrsCard: FsrsCardSnapshot;
}

/** Notes document for one problem (TipTap JSON). */
export interface Note {
  problemId: string;
  /** Serialized TipTap document. */
  contentJson: string;
  updatedAt: IsoDateTime;
}

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

export function isPerformanceScore(value: unknown): value is PerformanceScore {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5;
}

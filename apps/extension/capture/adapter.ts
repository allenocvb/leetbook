import { isDifficulty, slugFromUrl } from "@leetbook/core";
// Type-only, so this does not create a runtime cycle with the source registry below it.
import type { ProblemMeta } from "./source.js";

/**
 * ⚠️ The ONLY module that knows LeetCode's page internals (DOM locators,
 * localStorage layout, GraphQL shape). When LeetCode changes, this file —
 * and only this file — breaks. Everything here is pure and injectable
 * so the blast radius stays testable.
 */

/** LeetCode marks the submission verdict with this locator. */
const RESULT_LOCATOR = '[data-e2e-locator="submission-result"]';

export function slugFromLocation(href: string): string | null {
  return slugFromUrl(href);
}

/** True when the page currently shows an Accepted verdict. */
export function isAcceptedResult(root: ParentNode): boolean {
  const result = root.querySelector(RESULT_LOCATOR);
  return result?.textContent?.trim() === "Accepted";
}

export interface SubmissionStats {
  runtimeMs: number | null;
  memoryMb: number | null;
}

function parseStats(text: string): SubmissionStats {
  const runtime = /(\d+(?:\.\d+)?)\s*ms/i.exec(text);
  const memory = /(\d+(?:\.\d+)?)\s*MB/i.exec(text);
  return {
    runtimeMs: runtime?.[1] ? Number(runtime[1]) : null,
    memoryMb: memory?.[1] ? Number(memory[1]) : null,
  };
}

/** Far enough to reach the stats cards, short of scanning unrelated page chrome. */
const MAX_STATS_ANCESTORS = 10;

/**
 * Parses "61 ms" / "18.4 MB" from the smallest ancestor of the verdict that contains both.
 *
 * Climbs until it finds them rather than a fixed number of levels. The previous fixed climb
 * of 3 was one short of the real page — measured at 4 — so live captures silently recorded
 * no runtime or memory at all while the fixture test kept passing.
 */
export function extractStats(root: ParentNode): SubmissionStats {
  let scope: Element | null = root.querySelector(RESULT_LOCATOR);
  let best: SubmissionStats = { runtimeMs: null, memoryMb: null };

  for (let i = 0; i < MAX_STATS_ANCESTORS && scope; i++) {
    const stats = parseStats(scope.textContent ?? "");
    if (stats.runtimeMs !== null && stats.memoryMb !== null) return stats;
    if (stats.runtimeMs !== null || stats.memoryMb !== null) best = stats;
    scope = scope.parentElement;
  }
  return best;
}

interface GraphQlQuestion {
  data?: {
    question?: {
      title?: string;
      difficulty?: string;
      topicTags?: { name?: string }[];
    };
  };
}

const GRAPHQL_URL = "https://leetcode.com/graphql";
const QUESTION_QUERY = `query question($titleSlug: String!) {
  question(titleSlug: $titleSlug) { title difficulty topicTags { name } }
}`;

/** Fetches title/difficulty/topics from LeetCode's public GraphQL API. */
export async function fetchProblemMeta(
  slug: string,
  fetchFn: typeof fetch = fetch,
): Promise<ProblemMeta | null> {
  try {
    const response = await fetchFn(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUESTION_QUERY, variables: { titleSlug: slug } }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as GraphQlQuestion;
    const question = body.data?.question;
    if (!question?.title) return null;
    const difficulty = (question.difficulty ?? "").toLowerCase();
    if (!isDifficulty(difficulty)) return null;
    return {
      title: question.title,
      difficulty,
      tags: (question.topicTags ?? []).map((tag) => tag.name ?? "").filter(Boolean),
    };
  } catch {
    return null;
  }
}

/** `/problems/binary-search/submissions/7325539/` → `7325539`. */
export function submissionIdFromLocation(href: string): number | null {
  const match = /\/submissions\/(\d+)/.exec(href);
  const id = match?.[1] ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export interface SubmissionDetails {
  runtimeMs: number | null;
  memoryMb: number | null;
  language: string | null;
  code: string | null;
}

interface GraphQlSubmission {
  data?: {
    submissionDetails?: {
      runtime?: number | null;
      memory?: number | null;
      code?: string | null;
      lang?: { name?: string | null } | null;
    } | null;
  };
}

const SUBMISSION_QUERY = `query submissionDetails($submissionId: Int!) {
  submissionDetails(submissionId: $submissionId) {
    runtime
    memory
    code
    lang { name }
  }
}`;

/**
 * Reads the submission LeetCode just recorded, rather than scraping the page for it.
 *
 * The editor buffer is not in localStorage — keys there are numeric ids holding only the
 * selected language — and the Monaco editor virtualises its lines, so scraping the DOM would
 * silently truncate long solutions. This is an authenticated same-origin call, so the
 * content script's cookies carry it.
 */
export async function fetchSubmissionDetails(
  submissionId: number,
  fetchFn: typeof fetch = fetch,
): Promise<SubmissionDetails | null> {
  try {
    const response = await fetchFn(GRAPHQL_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: SUBMISSION_QUERY, variables: { submissionId } }),
    });
    if (!response.ok) return null;

    const details = ((await response.json()) as GraphQlSubmission).data?.submissionDetails;
    if (!details) return null;

    return {
      runtimeMs: typeof details.runtime === "number" ? details.runtime : null,
      // `memory` is bytes, and LeetCode reports decimal MB: 20460000 shows as "20.5 MB".
      memoryMb:
        typeof details.memory === "number" ? Math.round(details.memory / 100_000) / 10 : null,
      language: details.lang?.name ?? null,
      code: details.code?.trim() ? details.code : null,
    };
  } catch {
    return null;
  }
}

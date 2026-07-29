import type { Difficulty } from "@leetbook/core";
import {
  extractStats,
  fetchProblemMeta,
  fetchSubmissionDetails,
  isAcceptedResult,
  slugFromLocation,
  submissionIdFromLocation,
} from "./adapter.js";

/**
 * The contract every practice site must satisfy to be captured.
 *
 * Capture used to be LeetCode-shaped all the way through: the content script called
 * `adapter.ts` directly and its assumptions (a GraphQL metadata API, a submission id in the
 * URL) leaked into the shared pipeline. This interface is the seam — the toast, the queue,
 * the delivery relay and the desktop listener all sit downstream of it and know nothing
 * about which site a capture came from.
 *
 * A source owns its own page internals and nothing else. When a site changes, exactly one
 * implementation breaks.
 */
export interface CaptureSource {
  /** Stable identifier, recorded so a capture can be traced back to its origin. */
  readonly id: "leetcode" | "neetcode";
  /** Human-readable, for log lines and the pairing UI. */
  readonly name: string;
  /** Does this source handle the page currently open? */
  matches(href: string): boolean;
  /**
   * The problem's canonical slug, or null when this is not a problem page.
   *
   * Slugs are shared across sources on purpose: NeetCode practice is LeetCode practice, so
   * `two-sum` captured from either site must land on the same row rather than duplicating it.
   */
  slugFrom(href: string): string | null;
  /** Is an Accepted verdict on screen right now? */
  isAccepted(root: ParentNode): boolean;
  /** Title, difficulty and topics. Null aborts the capture — these cannot be invented. */
  readMeta(slug: string): Promise<ProblemMeta | null>;
  /** Everything about the submission itself. Always resolves; missing parts come back null. */
  readSubmission(href: string, root: ParentNode): Promise<SubmissionSnapshot>;
}

export interface ProblemMeta {
  title: string;
  difficulty: Difficulty;
  tags: string[];
}

export interface SubmissionSnapshot {
  runtimeMs: number | null;
  memoryMb: number | null;
  language: string | null;
  code: string | null;
  /** Why something is missing, for the console. Null when the snapshot is complete. */
  warning: string | null;
}

export const leetCodeSource: CaptureSource = {
  id: "leetcode",
  name: "LeetCode",
  matches: (href) => hostMatches(href, "leetcode.com"),
  slugFrom: slugFromLocation,
  isAccepted: isAcceptedResult,
  readMeta: (slug) => fetchProblemMeta(slug),

  /*
   * Prefer the submission API: it returns the exact code, language and stats LeetCode
   * recorded. The DOM stats remain a fallback for when the submission id is not in the URL
   * (an older result still on screen, or a navigation we did not follow).
   */
  async readSubmission(href, root) {
    const submissionId = submissionIdFromLocation(href);
    const submission = submissionId === null ? null : await fetchSubmissionDetails(submissionId);
    const domStats = extractStats(root);

    return {
      runtimeMs: submission?.runtimeMs ?? domStats.runtimeMs,
      memoryMb: submission?.memoryMb ?? domStats.memoryMb,
      language: submission?.language ?? null,
      code: submission?.code ?? null,
      warning: submission?.code
        ? null
        : submissionId === null
          ? "no submission id in the URL"
          : "submissionDetails returned nothing",
    };
  },
};

/** Every source the extension knows about, in match order. */
export const CAPTURE_SOURCES: readonly CaptureSource[] = [leetCodeSource];

/** The source that handles this page, or null when none does. */
export function sourceForUrl(href: string): CaptureSource | null {
  return CAPTURE_SOURCES.find((source) => source.matches(href)) ?? null;
}

/**
 * Exact host or subdomain, never a substring. `endsWith("leetcode.com")` would also accept
 * `notleetcode.com`, and a bare `includes` would accept any URL that merely mentions the
 * site in a query parameter.
 */
export function hostMatches(href: string, domain: string): boolean {
  let host: string;
  try {
    host = new URL(href).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === domain || host.endsWith(`.${domain}`);
}

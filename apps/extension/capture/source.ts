import type { Difficulty } from "@leetbook/core";
import {
  extractStats,
  fetchProblemMeta,
  fetchSubmissionDetails,
  isAcceptedResult,
  slugFromLocation,
  submissionIdFromLocation,
} from "./adapter.js";
import { requestProblemMeta } from "./metaRelay.js";
import * as neetcode from "./neetcode.js";

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
   * The problem's canonical slug — always LeetCode's — or null when this is not a problem
   * page or the source cannot establish identity.
   *
   * Identity is shared across sources on purpose: NeetCode practice is LeetCode practice, so
   * Two Sum solved on either site must land on one row rather than splitting one review
   * history into two useless halves. The page is passed in because a source may need the DOM
   * to work it out — NeetCode's own URL slug is renamed and cannot be used.
   */
  slugFrom(href: string, root: ParentNode): string | null;
  /** Is an Accepted verdict on screen right now? */
  isAccepted(root: ParentNode): boolean;
  /** Title, difficulty and topics. Null aborts the capture — these cannot be invented. */
  readMeta(slug: string, root: ParentNode): Promise<ProblemMeta | null>;
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

/**
 * NeetCode, joined to LeetCode by verified title.
 *
 * A factory rather than a constant so tests can supply the metadata lookup: the real one goes
 * through the background worker (see `metaRelay.ts`) and needs an extension context.
 */
export function createNeetCodeSource(
  fetchLeetCodeMeta: (slug: string) => Promise<ProblemMeta | null>,
): CaptureSource {
  return {
    id: "neetcode",
    name: "NeetCode",
    matches: (href) => hostMatches(href, "neetcode.io"),
    isAccepted: neetcode.isAcceptedResult,

    /*
     * Identity comes from the title, never NeetCode's URL. NeetCode renames slugs —
     * `two-integer-sum` is LeetCode's `two-sum` — but leaves the displayed title alone.
     * LeetCode's slugs are slugified titles, so the title converts directly.
     */
    slugFrom(_href, root) {
      const title = neetcode.extractTitle(root);
      return title === null ? null : neetcode.leetcodeSlugFromTitle(title);
    },

    /*
     * The slug above is a guess by construction, so it is confirmed here before anything is
     * written: fetch LeetCode's metadata and check the title agrees. A mismatch means the
     * slugify rule broke down for this problem, and the capture is abandoned rather than
     * merged into whatever row the wrong slug happened to name. Nothing can split two review
     * histories back apart afterwards, so guessing is not an acceptable failure.
     */
    async readMeta(slug, root) {
      const meta = await fetchLeetCodeMeta(slug);
      if (!meta) return null;

      const title = neetcode.extractTitle(root);
      if (title === null || !neetcode.titlesAgree(title, meta.title)) return null;
      return meta;
    },

    /*
     * Straight from the DOM, which works here and never could on LeetCode: NeetCode renders
     * the submission as static text, while LeetCode virtualises it in Monaco.
     */
    async readSubmission(_href, root) {
      const stats = neetcode.extractStats(root);
      const { code, language } = neetcode.extractCode(root);
      return {
        ...stats,
        language,
        code,
        warning: code ? null : "no rendered solution found on the submissions pane",
      };
    },
  };
}

export const neetCodeSource: CaptureSource = createNeetCodeSource(requestProblemMeta);

/** Every source the extension knows about, in match order. */
export const CAPTURE_SOURCES: readonly CaptureSource[] = [leetCodeSource, neetCodeSource];

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

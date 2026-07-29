import type { ProblemMeta } from "./source.js";

/**
 * Asks the background worker for a LeetCode problem's metadata.
 *
 * The detour exists because of CORS. A content script running on neetcode.io that calls
 * leetcode.com/graphql is making a cross-origin request, and LeetCode sends no permissive
 * `Access-Control-Allow-Origin`, so the browser blocks it. The background worker holds the
 * host permission and is not subject to the same check.
 *
 * LeetCode pages do not need this — there the call is same-origin — but routing both through
 * one path would cost a message round trip on the common case for no benefit.
 */
export interface ProblemMetaRequest {
  type: "leetbook-problem-meta";
  slug: string;
}

export function isProblemMetaRequest(message: unknown): message is ProblemMetaRequest {
  const typed = message as Partial<ProblemMetaRequest>;
  return typed?.type === "leetbook-problem-meta" && typeof typed.slug === "string";
}

/** Content-script side. Resolves null when the worker cannot reach LeetCode. */
export async function requestProblemMeta(slug: string): Promise<ProblemMeta | null> {
  const request: ProblemMetaRequest = { type: "leetbook-problem-meta", slug };
  try {
    const result: unknown = await browser.runtime.sendMessage(request);
    return isProblemMeta(result) ? result : null;
  } catch {
    return null;
  }
}

function isProblemMeta(value: unknown): value is ProblemMeta {
  const meta = value as Partial<ProblemMeta>;
  return (
    typeof meta?.title === "string" &&
    typeof meta.difficulty === "string" &&
    Array.isArray(meta.tags)
  );
}

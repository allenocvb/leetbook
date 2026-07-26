import { type Difficulty, isDifficulty, slugFromUrl } from "@leetbook/core";

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

/** Parses "61 ms" / "18.4 MB" out of the result panel's text. */
export function extractStats(root: ParentNode): SubmissionStats {
  // climb a few ancestors from the verdict so sibling stat rows are in scope
  let scope: Element | null = root.querySelector(RESULT_LOCATOR);
  for (let i = 0; i < 3 && scope?.parentElement; i++) {
    scope = scope.parentElement;
  }
  const text = scope?.textContent ?? "";
  const runtime = /(\d+(?:\.\d+)?)\s*ms/i.exec(text);
  const memory = /(\d+(?:\.\d+)?)\s*MB/i.exec(text);
  return {
    runtimeMs: runtime?.[1] ? Number(runtime[1]) : null,
    memoryMb: memory?.[1] ? Number(memory[1]) : null,
  };
}

export interface CodeCapture {
  language: string;
  code: string;
}

type StorageLike = Pick<Storage, "length" | "key" | "getItem">;

/**
 * LeetCode persists the editor buffer in localStorage under keys shaped like
 * `<questionId>_<slug>_<language>`. We scan for the slug and take the newest-
 * looking entry. Values are usually JSON-encoded strings.
 */
export function extractCode(slug: string, storage: StorageLike): CodeCapture | null {
  const needle = `_${slug}_`;
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (!key?.includes(needle)) continue;
    const raw = storage.getItem(key);
    if (!raw) continue;
    const language = key.slice(key.lastIndexOf("_") + 1);
    try {
      const decoded: unknown = JSON.parse(raw);
      if (typeof decoded === "string" && decoded.trim() !== "") {
        return { language, code: decoded };
      }
    } catch {
      if (raw.trim() !== "") return { language, code: raw };
    }
  }
  return null;
}

export interface ProblemMeta {
  title: string;
  difficulty: Difficulty;
  tags: string[];
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

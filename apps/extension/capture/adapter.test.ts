import { describe, expect, it, vi } from "vitest";
import {
  extractCode,
  extractStats,
  fetchProblemMeta,
  isAcceptedResult,
  slugFromLocation,
} from "./adapter.js";

function page(html: string): Document {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = html;
  return doc;
}

describe("slugFromLocation", () => {
  it("extracts the slug from problem URLs", () => {
    expect(slugFromLocation("https://leetcode.com/problems/two-sum/submissions/123/")).toBe(
      "two-sum",
    );
    expect(slugFromLocation("https://leetcode.com/problemset/")).toBeNull();
  });
});

describe("isAcceptedResult", () => {
  it("detects the Accepted verdict", () => {
    expect(
      isAcceptedResult(page('<span data-e2e-locator="submission-result">Accepted</span>')),
    ).toBe(true);
  });

  it("rejects other verdicts and absence", () => {
    expect(
      isAcceptedResult(page('<span data-e2e-locator="submission-result">Wrong Answer</span>')),
    ).toBe(false);
    expect(isAcceptedResult(page("<div>nothing here</div>"))).toBe(false);
  });
});

describe("extractStats", () => {
  it("parses runtime and memory near the verdict", () => {
    const doc = page(
      `<div><div><span data-e2e-locator="submission-result">Accepted</span></div>
        <div>Runtime <b>61 ms</b> · beats 92%</div>
        <div>Memory <b>18.4 MB</b> · beats 88%</div></div>`,
    );
    expect(extractStats(doc)).toEqual({ runtimeMs: 61, memoryMb: 18.4 });
  });

  it("returns nulls when stats are missing", () => {
    const doc = page('<span data-e2e-locator="submission-result">Accepted</span>');
    expect(extractStats(doc)).toEqual({ runtimeMs: null, memoryMb: null });
  });
});

describe("extractCode", () => {
  function fakeStorage(entries: Record<string, string>) {
    const keys = Object.keys(entries);
    return {
      length: keys.length,
      key: (i: number) => keys[i] ?? null,
      getItem: (key: string) => entries[key] ?? null,
    };
  }

  it("finds the JSON-encoded buffer for the slug and derives the language", () => {
    const storage = fakeStorage({
      unrelated: "x",
      "1_two-sum_python3": JSON.stringify("def twoSum(self): ..."),
    });
    expect(extractCode("two-sum", storage)).toEqual({
      language: "python3",
      code: "def twoSum(self): ...",
    });
  });

  it("falls back to the raw value when not JSON", () => {
    const storage = fakeStorage({ "1_lru-cache_cpp": "class LRUCache {};" });
    expect(extractCode("lru-cache", storage)).toEqual({
      language: "cpp",
      code: "class LRUCache {};",
    });
  });

  it("ignores other slugs and empty buffers", () => {
    const storage = fakeStorage({
      "1_two-sum_python3": JSON.stringify(""),
      "2_other-problem_python3": JSON.stringify("nope"),
    });
    expect(extractCode("two-sum", storage)).toBeNull();
  });
});

describe("fetchProblemMeta", () => {
  it("maps the GraphQL response to problem metadata", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              question: {
                title: "Two Sum",
                difficulty: "Easy",
                topicTags: [{ name: "Array" }, { name: "Hash Table" }],
              },
            },
          }),
        ),
    );
    const meta = await fetchProblemMeta("two-sum", fetchFn as unknown as typeof fetch);
    expect(meta).toEqual({ title: "Two Sum", difficulty: "easy", tags: ["Array", "Hash Table"] });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://leetcode.com/graphql");
    expect(JSON.parse(init.body as string).variables.titleSlug).toBe("two-sum");
  });

  it("returns null on HTTP errors, network errors, and unknown difficulty", async () => {
    const badStatus = vi.fn(async () => new Response("nope", { status: 500 }));
    expect(await fetchProblemMeta("x", badStatus as unknown as typeof fetch)).toBeNull();

    const throws = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await fetchProblemMeta("x", throws as unknown as typeof fetch)).toBeNull();

    const weird = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { question: { title: "X", difficulty: "Extreme" } } })),
    );
    expect(await fetchProblemMeta("x", weird as unknown as typeof fetch)).toBeNull();
  });
});

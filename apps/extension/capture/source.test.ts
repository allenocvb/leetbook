import { describe, expect, it, vi } from "vitest";
import type { ProblemMeta } from "./source.js";
import {
  CAPTURE_SOURCES,
  createNeetCodeSource,
  hostMatches,
  leetCodeSource,
  neetCodeSource,
  sourceForUrl,
} from "./source.js";

describe("hostMatches", () => {
  it("accepts the site and its subdomains", () => {
    expect(hostMatches("https://leetcode.com/problems/two-sum/", "leetcode.com")).toBe(true);
    expect(hostMatches("https://www.leetcode.com/problems/two-sum/", "leetcode.com")).toBe(true);
  });

  it("rejects a host that merely ends with the domain", () => {
    // The obvious `endsWith` implementation would hand this page LeetCode's GraphQL client.
    expect(hostMatches("https://notleetcode.com/problems/two-sum/", "leetcode.com")).toBe(false);
  });

  it("rejects a URL that only mentions the site", () => {
    expect(hostMatches("https://example.com/?to=leetcode.com", "leetcode.com")).toBe(false);
  });

  it("rejects a malformed URL rather than throwing", () => {
    expect(hostMatches("not a url", "leetcode.com")).toBe(false);
  });
});

describe("sourceForUrl", () => {
  it("routes a LeetCode problem page to the LeetCode source", () => {
    expect(sourceForUrl("https://leetcode.com/problems/two-sum/")).toBe(leetCodeSource);
  });

  it("routes a NeetCode problem page to the NeetCode source", () => {
    expect(sourceForUrl("https://neetcode.io/problems/two-integer-sum/history")).toBe(
      neetCodeSource,
    );
  });

  it("returns null for a site no source claims", () => {
    expect(sourceForUrl("https://example.com/problems/two-sum/")).toBeNull();
  });
});

describe("capture sources", () => {
  it("gives every source a distinct id", () => {
    const ids = CAPTURE_SOURCES.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("claims no page that another source already claims", () => {
    // Two sources matching one host would make capture depend on registration order.
    const urls = [
      "https://leetcode.com/problems/two-sum/",
      "https://neetcode.io/problems/two-integer-sum/history",
    ];
    for (const url of urls) {
      expect(CAPTURE_SOURCES.filter((source) => source.matches(url))).toHaveLength(1);
    }
  });
});

describe("neetCodeSource identity", () => {
  const TWO_SUM: ProblemMeta = { title: "Two Sum", difficulty: "easy", tags: ["Array"] };

  const pageTitled = (title: string): ParentNode => {
    const root = document.createElement("div");
    root.innerHTML = `<h1 class="problem-title">${title}</h1>`;
    return root;
  };

  it("identifies the problem by title, ignoring NeetCode's renamed slug", () => {
    const source = createNeetCodeSource(async () => TWO_SUM);
    const slug = source.slugFrom(
      "https://neetcode.io/problems/two-integer-sum/history",
      pageTitled("Two Sum"),
    );
    // NeetCode calls it two-integer-sum; the row it belongs on is LeetCode's two-sum.
    expect(slug).toBe("two-sum");
  });

  it("accepts the capture when LeetCode confirms the title", async () => {
    const source = createNeetCodeSource(async () => TWO_SUM);
    expect(await source.readMeta("two-sum", pageTitled("Two Sum"))).toEqual(TWO_SUM);
  });

  it("refuses the capture when LeetCode returns a different problem", async () => {
    /*
     * The failure this whole design exists to prevent. If the slugify rule ever lands on a
     * real but different problem, capturing would fold two review histories together, and
     * the app has no way to pull them back apart.
     */
    const wrongProblem: ProblemMeta = {
      title: "Two Sum II - Input Array Is Sorted",
      difficulty: "medium",
      tags: [],
    };
    const source = createNeetCodeSource(async () => wrongProblem);
    expect(await source.readMeta("two-sum-ii", pageTitled("Two Sum"))).toBeNull();
  });

  it("refuses the capture when LeetCode has no such problem", async () => {
    const source = createNeetCodeSource(async () => null);
    expect(await source.readMeta("some-neetcode-exclusive", pageTitled("Neet Only"))).toBeNull();
  });

  it("does not look the problem up at all when the page has no title", async () => {
    const lookup = vi.fn(async () => TWO_SUM);
    const source = createNeetCodeSource(lookup);
    expect(source.slugFrom("https://neetcode.io/problems/x", pageTitled(""))).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe("neetCodeSource.readSubmission", () => {
  it("reads code and stats straight from the DOM", async () => {
    const source = createNeetCodeSource(async () => null);
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="submission-header"><p>Memory: 7.7 MB · Time: 28ms</p></div>
      <div><p>Code | Python</p><pre><code>class Solution:
    def twoSum(self): return []</code></pre></div>`;

    const snapshot = await source.readSubmission("https://neetcode.io/problems/x", root);

    expect(snapshot).toEqual({
      runtimeMs: 28,
      memoryMb: 7.7,
      language: "python",
      code: "class Solution:\n    def twoSum(self): return []",
      warning: null,
    });
  });

  it("explains the gap when no solution is rendered", async () => {
    const source = createNeetCodeSource(async () => null);
    const root = document.createElement("div");
    root.innerHTML = '<div class="submission-header"><p>Time: 28ms</p></div>';

    const snapshot = await source.readSubmission("https://neetcode.io/problems/x", root);
    expect(snapshot.code).toBeNull();
    expect(snapshot.warning).toMatch(/no rendered solution/);
  });
});

describe("leetCodeSource.readSubmission", () => {
  const pageWith = (html: string): ParentNode => {
    const root = document.createElement("div");
    root.innerHTML = html;
    return root;
  };

  it("falls back to the DOM stats and explains the gap when there is no submission id", async () => {
    const root = pageWith(
      `<div><div data-e2e-locator="submission-result">Accepted</div>
       <div>Runtime 61 ms</div><div>Memory 18.4 MB</div></div>`,
    );

    const snapshot = await leetCodeSource.readSubmission(
      "https://leetcode.com/problems/two-sum/",
      root,
    );

    expect(snapshot).toEqual({
      runtimeMs: 61,
      memoryMb: 18.4,
      language: null,
      code: null,
      warning: "no submission id in the URL",
    });
  });
});

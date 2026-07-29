import { describe, expect, it } from "vitest";
import { CAPTURE_SOURCES, hostMatches, leetCodeSource, sourceForUrl } from "./source.js";

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
    const urls = ["https://leetcode.com/problems/two-sum/"];
    for (const url of urls) {
      expect(CAPTURE_SOURCES.filter((source) => source.matches(url))).toHaveLength(1);
    }
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

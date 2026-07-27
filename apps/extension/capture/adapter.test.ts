import { describe, expect, it, vi } from "vitest";
import acceptedFixture from "./__fixtures__/leetcode-accepted.html?raw";
import {
  extractStats,
  fetchProblemMeta,
  fetchSubmissionDetails,
  isAcceptedResult,
  slugFromLocation,
  submissionIdFromLocation,
} from "./adapter.js";

/** Minimal stand-in for a fetch Response carrying a JSON body. */
function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as unknown as Response;
}

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

  it("finds stats however deep the shared ancestor sits", () => {
    // Measured on a real Accepted page: the verdict and the stats cards share an ancestor
    // 4 levels up. The old fixed climb of 3 stopped one short and recorded nothing.
    const doc = page(
      `<section>
         <div>
           <div>
             <div><div><span data-e2e-locator="submission-result">Accepted</span></div></div>
           </div>
           <div>Runtime <b>0 ms</b> Beats 100.00%</div>
           <div>Memory <b>20.39 MB</b> Beats 58.13%</div>
         </div>
       </section>`,
    );
    // 0 ms is the real value from a fast solution, and a classic falsy-number trap.
    expect(extractStats(doc)).toEqual({ runtimeMs: 0, memoryMb: 20.39 });
  });

  it("returns nulls when stats are missing", () => {
    const doc = page('<span data-e2e-locator="submission-result">Accepted</span>');
    expect(extractStats(doc)).toEqual({ runtimeMs: null, memoryMb: null });
  });

  it("detects Accepted and reads stats from the fixture page", () => {
    const fixture = page(acceptedFixture);
    expect(isAcceptedResult(fixture)).toBe(true);
    expect(extractStats(fixture)).toEqual({ runtimeMs: 78, memoryMb: 17.1 });
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

describe("submissionIdFromLocation", () => {
  it("reads the id LeetCode puts in the URL after submitting", () => {
    expect(
      submissionIdFromLocation("https://leetcode.com/problems/binary-search/submissions/7325539/"),
    ).toBe(7325539);
  });

  it("is null on a plain problem page", () => {
    expect(submissionIdFromLocation("https://leetcode.com/problems/binary-search/")).toBeNull();
    expect(submissionIdFromLocation("https://leetcode.com/submissions/")).toBeNull();
  });
});

describe("fetchSubmissionDetails", () => {
  // Verbatim shape from a real Accepted submission.
  const REAL = {
    data: {
      submissionDetails: {
        runtime: 0,
        memory: 20460000,
        lang: { name: "python3" },
        code: "class Solution:\n    def search(self, nums: List[int], target: int) -> int:\n        pass",
      },
    },
  };

  it("returns the code, language and stats", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(REAL));
    const details = await fetchSubmissionDetails(7325539, fetchFn as unknown as typeof fetch);

    expect(details?.code).toContain("class Solution:");
    expect(details?.language).toBe("python3");
    // 0 ms is real and must not collapse to null.
    expect(details?.runtimeMs).toBe(0);
    // Bytes to decimal MB, matching LeetCode's own "20.5 MB".
    expect(details?.memoryMb).toBe(20.5);
  });

  it("sends cookies, since the submission is private to the user", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(REAL));
    await fetchSubmissionDetails(7325539, fetchFn as unknown as typeof fetch);
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("include");
  });

  it("returns null rather than a half-filled capture when the query fails", async () => {
    const errored = vi.fn(async () => jsonResponse({ errors: [{ message: "nope" }] }));
    expect(await fetchSubmissionDetails(1, errored as unknown as typeof fetch)).toBeNull();

    const offline = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await fetchSubmissionDetails(1, offline as unknown as typeof fetch)).toBeNull();
  });

  it("treats blank code as absent", async () => {
    const blank = vi.fn(async () =>
      jsonResponse({ data: { submissionDetails: { runtime: 5, memory: 1000000, code: "  " } } }),
    );
    const details = await fetchSubmissionDetails(1, blank as unknown as typeof fetch);
    expect(details?.code).toBeNull();
    expect(details?.runtimeMs).toBe(5);
  });
});

import { describe, expect, it } from "vitest";
import {
  extractCode,
  extractStats,
  extractTitle,
  isAcceptedResult,
  leetcodeSlugFromTitle,
  neetcodeSlugFromLocation,
  titlesAgree,
} from "./neetcode.js";

const SOLUTION = `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        indices = {}  # val -> index

        for i, n in enumerate(nums):
            indices[n] = i

        for i, n in enumerate(nums):
            diff = target - n
            if diff in indices and indices[diff] != i:
                return [i, indices[diff]]
        return []`;

/**
 * Modelled on a real Accepted submission (July 2026), including the runtime distribution
 * chart — its axis labels are times, and a document-wide regex picks one of those up instead
 * of the actual runtime.
 */
const ACCEPTED_PAGE = `
<app-prompt>
  <div class="question-tab">
    <div class="tab-content-padding">
      <div class="flex-container-row problem-title-row">
        <h1 class="problem-title">Two Sum</h1>
        <fa-icon class="ng-fa-icon solved-badge-icon"></fa-icon>
      </div>
    </div>
  </div>
  <div class="submissions-tab tab-content-padding">
    <div class="submission-detail">
      <div class="submission-header">
        <div class="submission-status-row">
          <h1 class="submission-status-title submission-result-accepted">Accepted</h1>
          <span>23 / 23 test cases</span>
        </div>
        <p>Memory: 7.7 MB &middot; Time: 28ms &middot; Submitted at: 07/28/2026 21:45</p>
      </div>
      <div class="runtime-chart">
        <span>24ms</span><span>216ms</span><span>408ms</span><span>1752ms</span>
      </div>
      <div class="code-section">
        <p class="code-heading">Code | Python</p>
        <pre><code>${SOLUTION}</code></pre>
      </div>
    </div>
  </div>
</app-prompt>`;

const page = (html: string): ParentNode => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
};

describe("isAcceptedResult", () => {
  it("sees the verdict", () => {
    expect(isAcceptedResult(page(ACCEPTED_PAGE))).toBe(true);
  });

  it("is false before a submission", () => {
    expect(isAcceptedResult(page('<h1 class="problem-title">Two Sum</h1>'))).toBe(false);
  });

  it("also sees the console pane's verdict, which is a p rather than an h1", () => {
    const console = `<div class="output-header"><div class="status-row">
      <p class="submission-result-accepted">Accepted</p></div></div>`;
    expect(isAcceptedResult(page(console))).toBe(true);
  });
});

describe("neetcodeSlugFromLocation", () => {
  it("reads the slug from the path, not the last segment", () => {
    // After a submission the URL ends in /history, which is not the slug.
    expect(
      neetcodeSlugFromLocation("https://neetcode.io/problems/two-integer-sum/history?x=3"),
    ).toBe("two-integer-sum");
  });

  it("returns null off a problem page", () => {
    expect(neetcodeSlugFromLocation("https://neetcode.io/practice")).toBeNull();
  });
});

describe("extractTitle", () => {
  it("reads the displayed title, which agrees with LeetCode even when the slug does not", () => {
    expect(extractTitle(page(ACCEPTED_PAGE))).toBe("Two Sum");
  });

  it("returns null when the title is absent", () => {
    expect(extractTitle(page("<div></div>"))).toBeNull();
  });
});

describe("leetcodeSlugFromTitle", () => {
  it("slugifies the way LeetCode does", () => {
    expect(leetcodeSlugFromTitle("Two Sum")).toBe("two-sum");
    expect(leetcodeSlugFromTitle("Best Time to Buy and Sell Stock")).toBe(
      "best-time-to-buy-and-sell-stock",
    );
    expect(leetcodeSlugFromTitle("Course Schedule II")).toBe("course-schedule-ii");
    expect(leetcodeSlugFromTitle("Number of 1 Bits")).toBe("number-of-1-bits");
  });

  it("drops apostrophes rather than turning them into separators", () => {
    // "pascal-s-triangle" is not a LeetCode slug and would 404 the verification fetch.
    expect(leetcodeSlugFromTitle("Pascal's Triangle")).toBe("pascals-triangle");
    expect(leetcodeSlugFromTitle("Pascal’s Triangle")).toBe("pascals-triangle");
  });

  it("returns null for a title with nothing sluggable in it", () => {
    expect(leetcodeSlugFromTitle("   ")).toBeNull();
  });
});

describe("titlesAgree", () => {
  it("ignores case and punctuation", () => {
    expect(titlesAgree("Pascal's Triangle", "Pascals Triangle")).toBe(true);
    expect(titlesAgree("Two Sum", "two sum")).toBe(true);
  });

  it("rejects different problems", () => {
    // The whole point of verification: these three are distinct problems.
    expect(titlesAgree("Subarray Sum Equals K", "Minimum Size Subarray Sum")).toBe(false);
    expect(titlesAgree("Two Sum", "Two Sum II")).toBe(false);
  });
});

describe("extractStats", () => {
  it("reads runtime and memory from the submission header", () => {
    expect(extractStats(page(ACCEPTED_PAGE))).toEqual({ runtimeMs: 28, memoryMb: 7.7 });
  });

  it("ignores the runtime chart's axis labels", () => {
    // Scoped to the header for this reason: 24ms is a chart tick, not this submission.
    const stats = extractStats(page(ACCEPTED_PAGE));
    expect(stats.runtimeMs).not.toBe(24);
  });

  it("returns nulls rather than throwing when the header is missing", () => {
    expect(extractStats(page("<div></div>"))).toEqual({ runtimeMs: null, memoryMb: null });
  });
});

describe("extractCode", () => {
  it("reads the rendered solution and its language", () => {
    const captured = extractCode(page(ACCEPTED_PAGE));
    expect(captured.language).toBe("python");
    expect(captured.code).toBe(SOLUTION);
  });

  it("keeps the indentation, which is load-bearing in Python", () => {
    expect(extractCode(page(ACCEPTED_PAGE)).code).toContain("\n        indices = {}");
  });

  it("reports nothing rather than a fragment when no solution is rendered", () => {
    const noCode = '<div class="code-section"><p>Code | Python</p></div>';
    expect(extractCode(page(noCode))).toEqual({ code: null, language: "python" });
  });

  it("returns nulls on a page with no code section", () => {
    expect(extractCode(page(ACCEPTED_PAGE.replace(/Code \| Python/, "Notes")))).toEqual({
      code: null,
      language: null,
    });
  });
});

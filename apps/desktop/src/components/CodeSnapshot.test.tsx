import type { Review } from "@leetbook/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeSnapshot } from "./CodeSnapshot.js";

const REVIEW: Review = {
  id: "review-1",
  problemId: "two-sum",
  score: 4,
  reviewedAt: "2026-07-21T00:00:00.000Z",
  runtimeMs: 61,
  memoryMb: 18.4,
  language: "python3",
  codeSnapshot: "def two_sum(nums):\n    return []",
};

describe("CodeSnapshot", () => {
  it("normalizes the language, highlights code, and remains read-only", () => {
    render(<CodeSnapshot review={REVIEW} />);

    const snapshot = screen.getByRole("region", { name: "Latest solution snapshot" });
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("snapshot · Jul 21")).toBeInTheDocument();
    expect(snapshot.querySelector("code")).toHaveTextContent("def two_sum(nums): return []");
    expect(snapshot.querySelector(".hljs-keyword")).toHaveTextContent("def");
    expect(screen.queryByRole("combobox", { name: "Code language" })).not.toBeInTheDocument();
  });

  it("renders nothing when the review has no saved code", () => {
    const { container } = render(<CodeSnapshot review={{ ...REVIEW, codeSnapshot: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

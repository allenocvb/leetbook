import type { TableRow } from "@leetbook/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProblemTableRow } from "./ProblemTableRow.js";

const row = (tags: string[]): TableRow => ({
  problemId: "p1",
  title: "Two Sum",
  slug: "two-sum",
  url: "https://leetcode.com/problems/two-sum/",
  difficulty: "easy",
  tags,
  status: "learning",
  nextReview: "2030-01-01T00:00:00.000Z",
  lastReview: "2029-12-01T00:00:00.000Z",
  lastScore: 4,
  reviewCount: 3,
});

const renderRow = (tags: string[]) =>
  render(<ProblemTableRow row={row(tags)} number={1} onOpen={() => {}} onDelete={() => {}} />);

describe("ProblemTableRow categories", () => {
  it("shows each category as its own chip", () => {
    renderRow(["Array", "Hash Table"]);
    expect(screen.getByText("Array")).toBeInTheDocument();
    expect(screen.getByText("Hash Table")).toBeInTheDocument();
  });

  it("collapses the overflow into a count so the row stays one line tall", () => {
    renderRow(["Array", "Hash Table", "Two Pointers", "Sorting"]);

    expect(screen.getByText("Array")).toBeInTheDocument();
    expect(screen.getByText("Hash Table")).toBeInTheDocument();
    expect(screen.queryByText("Two Pointers")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("keeps the full list available on hover", () => {
    const { container } = renderRow(["Array", "Hash Table", "Sorting"]);
    // The chips hide the tail, so the title attribute is the only place it survives.
    expect(container.querySelector(".problem-row__category")).toHaveAttribute(
      "title",
      "Array, Hash Table, Sorting",
    );
  });

  it("shows a dash rather than an empty cell when there are no categories", () => {
    renderRow([]);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

import type { TableRow } from "@leetbook/core";
import { describe, expect, it } from "vitest";
import { collectCategories, filterRows, sortRows } from "./rowLogic.js";

function row(overrides: Partial<TableRow>): TableRow {
  return {
    problemId: overrides.slug ?? "id",
    slug: "slug",
    title: "Title",
    url: "https://leetcode.com/problems/slug/",
    difficulty: "easy",
    tags: [],
    status: "new",
    nextReview: null,
    lastReview: null,
    lastScore: null,
    reviewCount: 0,
    ...overrides,
  };
}

const ROWS: TableRow[] = [
  row({
    slug: "b",
    title: "Binary Search",
    difficulty: "medium",
    tags: ["Binary Search"],
    nextReview: "2026-08-01T00:00:00.000Z",
    lastScore: 3,
  }),
  row({
    slug: "a",
    title: "Two Sum",
    difficulty: "easy",
    tags: ["Array"],
    nextReview: null,
    lastScore: null,
  }),
  row({
    slug: "c",
    title: "Word Ladder",
    difficulty: "hard",
    tags: ["Graphs"],
    nextReview: "2026-07-01T00:00:00.000Z",
    lastScore: 5,
  }),
];

describe("sortRows", () => {
  it("sorts by title in both directions", () => {
    expect(sortRows(ROWS, { key: "title", dir: "asc" }).map((r) => r.slug)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(sortRows(ROWS, { key: "title", dir: "desc" }).map((r) => r.slug)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("sorts by difficulty order easy < medium < hard", () => {
    expect(sortRows(ROWS, { key: "difficulty", dir: "asc" }).map((r) => r.difficulty)).toEqual([
      "easy",
      "medium",
      "hard",
    ]);
  });

  it("sorts by nextReview with nulls last in either direction", () => {
    expect(sortRows(ROWS, { key: "nextReview", dir: "asc" }).map((r) => r.slug)).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(
      sortRows(ROWS, { key: "nextReview", dir: "desc" })
        .map((r) => r.slug)
        .at(-1),
    ).not.toBe("a");
  });

  it("does not mutate the input", () => {
    const before = ROWS.map((r) => r.slug);
    sortRows(ROWS, { key: "title", dir: "desc" });
    expect(ROWS.map((r) => r.slug)).toEqual(before);
  });
});

describe("filterRows", () => {
  it("matches title and slug case-insensitively", () => {
    expect(filterRows(ROWS, { query: "two", category: null })).toHaveLength(1);
    expect(filterRows(ROWS, { query: "WORD", category: null })[0]?.slug).toBe("c");
  });

  it("filters by category", () => {
    expect(filterRows(ROWS, { query: "", category: "Array" })[0]?.slug).toBe("a");
    expect(filterRows(ROWS, { query: "", category: "Nope" })).toHaveLength(0);
  });

  it("combines query and category", () => {
    expect(filterRows(ROWS, { query: "two", category: "Graphs" })).toHaveLength(0);
  });
});

describe("collectCategories", () => {
  it("returns unique sorted categories", () => {
    expect(collectCategories(ROWS)).toEqual(["Array", "Binary Search", "Graphs"]);
  });
});

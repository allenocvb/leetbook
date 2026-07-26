import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DbProvider } from "../db/DbContext.js";
import { makeDb, seed } from "../test-utils.js";
import { AllProblemsPage } from "./AllProblemsPage.js";

async function renderPage(onOpenProblem = vi.fn()) {
  const db = await makeDb();
  await seed(db, [
    { slug: "two-sum", title: "Two Sum", difficulty: "easy", tags: ["Array"], scores: [3, 5] },
    { slug: "word-ladder", title: "Word Ladder", difficulty: "hard", tags: ["Graphs"] },
  ]);
  render(
    <DbProvider db={db}>
      <AllProblemsPage onOpenProblem={onOpenProblem} />
    </DbProvider>,
  );
  await waitFor(() => expect(screen.getByText("Two Sum")).toBeInTheDocument());
  return { onOpenProblem };
}

describe("AllProblemsPage", () => {
  it("renders rows from the database with derived fields", async () => {
    await renderPage();
    expect(screen.getByText("Word Ladder")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument(); // word-ladder has no reviews
    expect(screen.getByText("Hard")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 problems")).toBeInTheDocument();
  });

  it("links each problem to LeetCode and opens notes on title click", async () => {
    const { onOpenProblem } = await renderPage();
    expect(screen.getByRole("link", { name: "Open Two Sum on LeetCode" })).toHaveAttribute(
      "href",
      "https://leetcode.com/problems/two-sum/",
    );
    await userEvent.click(screen.getByRole("button", { name: "Two Sum" }));
    expect(onOpenProblem).toHaveBeenCalledTimes(1);
  });

  it("filters by search query", async () => {
    await renderPage();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search problems" }), "ladder");
    expect(screen.queryByText("Two Sum")).not.toBeInTheDocument();
    expect(screen.getByText("Word Ladder")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 problems")).toBeInTheDocument();
  });

  it("filters by category", async () => {
    await renderPage();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Filter by category" }),
      "Array",
    );
    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    expect(screen.queryByText("Word Ladder")).not.toBeInTheDocument();
  });

  it("sorts by clicking a column header", async () => {
    await renderPage();
    const firstTitle = () => screen.getAllByRole("row")[1]?.textContent;
    // default: title asc → Two Sum before Word Ladder
    expect(firstTitle()).toContain("Two Sum");
    await userEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(firstTitle()).toContain("Word Ladder");
  });
});

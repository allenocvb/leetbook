import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DbProvider } from "../db/DbContext.js";
import { makeDb, seed } from "../test-utils.js";
import { AllProblemsPage } from "./AllProblemsPage.js";

async function renderPage({
  onOpenProblem = vi.fn(),
  category = null,
  onCategoryChange = vi.fn(),
}: {
  onOpenProblem?: ReturnType<typeof vi.fn>;
  category?: string | null;
  onCategoryChange?: ReturnType<typeof vi.fn>;
} = {}) {
  const db = await makeDb();
  await seed(db, [
    { slug: "two-sum", title: "Two Sum", difficulty: "easy", tags: ["Array"], scores: [3, 5] },
    { slug: "word-ladder", title: "Word Ladder", difficulty: "hard", tags: ["Graphs"] },
  ]);
  const view = render(
    <DbProvider db={db}>
      <AllProblemsPage
        onOpenProblem={onOpenProblem}
        category={category}
        onCategoryChange={onCategoryChange}
      />
    </DbProvider>,
  );
  await waitFor(() => expect(screen.getByText("Two Sum")).toBeInTheDocument());
  return { db, onOpenProblem, onCategoryChange, ...view };
}

describe("AllProblemsPage", () => {
  it("renders rows from the database with derived fields", async () => {
    await renderPage();
    expect(screen.getByText("Word Ladder")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument(); // word-ladder has no reviews
    expect(screen.getByText("Hard")).toBeInTheDocument();
    expect(screen.getByText("2 problems")).toBeInTheDocument();
    expect(screen.getByText("5")).toHaveClass("score-chip--high");
  });

  it("refreshes visible rows after an external database write", async () => {
    const { db, rerender } = await renderPage();
    await seed(db, [{ slug: "captured", title: "Captured Problem", tags: ["Array"] }]);
    rerender(
      <DbProvider db={db}>
        <AllProblemsPage onOpenProblem={vi.fn()} refreshKey={1} />
      </DbProvider>,
    );

    await waitFor(() => expect(screen.getByText("Captured Problem")).toBeInTheDocument());
  });

  it("opens notes from the full row and keeps the arrow decorative", async () => {
    const { onOpenProblem } = await renderPage();
    expect(
      screen.queryByRole("link", { name: "Open Two Sum on LeetCode" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open notes for Two Sum" }));
    expect(onOpenProblem).toHaveBeenCalledTimes(1);
  });

  it("filters by search query", async () => {
    await renderPage();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search problems" }), "ladder");
    expect(screen.queryByText("Two Sum")).not.toBeInTheDocument();
    expect(screen.getByText("Word Ladder")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 problems")).toBeInTheDocument();
  });

  it("clears active search filters from the filter menu", async () => {
    await renderPage();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search problems" }), "ladder");
    await userEvent.click(screen.getByRole("button", { name: /Filter/ }));
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    expect(screen.getByText("Word Ladder")).toBeInTheDocument();
    expect(screen.getByText("2 problems")).toBeInTheDocument();
  });

  it("shows the final no-results state", async () => {
    await renderPage();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search problems" }), "missing");

    expect(
      screen.getByText("Nothing here yet — nothing matches these filters."),
    ).toBeInTheDocument();
  });

  it("filters by category", async () => {
    const { onCategoryChange } = await renderPage({ category: "Array" });
    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    expect(screen.queryByText("Word Ladder")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Array/ }));
    expect(onCategoryChange).toHaveBeenCalledWith(null);
  });

  it("sorts by clicking a column header", async () => {
    await renderPage();
    const firstTitle = () => document.querySelector(".problem-row")?.textContent;
    // default: title asc → Two Sum before Word Ladder
    expect(firstTitle()).toContain("Two Sum");
    await userEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(firstTitle()).toContain("Word Ladder");
  });

  it("switches between comfortable and compact density", async () => {
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Filter" }));
    await userEvent.click(screen.getByRole("button", { name: "Compact" }));

    expect(document.querySelector(".problem-table-scroll")).toHaveAttribute(
      "data-density",
      "compact",
    );
  });

  it("opens the new-problem dialog from the footer affordance", async () => {
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "+ New" }));
    expect(screen.getByRole("dialog", { name: "New problem" })).toBeInTheDocument();
  });
});

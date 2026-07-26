import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DbProvider } from "../db/DbContext.js";
import { AllProblemsPage } from "../pages/AllProblemsPage.js";
import { makeDb } from "../test-utils.js";
import { resolveSlug, titleFromSlug } from "./AddProblemDialog.js";
import { parseCategories } from "./problem/ProblemForm.js";

describe("resolveSlug", () => {
  it("accepts full URLs, description URLs, and bare slugs", () => {
    expect(resolveSlug("https://leetcode.com/problems/two-sum/")).toBe("two-sum");
    expect(resolveSlug("https://leetcode.com/problems/lru-cache/description/")).toBe("lru-cache");
    expect(resolveSlug("Two-Sum")).toBe("two-sum");
  });

  it("rejects empty and unusable input", () => {
    expect(resolveSlug("")).toBeNull();
    expect(resolveSlug("https://example.com/problems/x/")).toBeNull();
    expect(resolveSlug("http://leetcode.com/problems/two-sum/")).toBeNull();
    expect(resolveSlug("https://example.com/?next=leetcode.com/problems/two-sum/")).toBeNull();
    expect(resolveSlug("not a slug!")).toBeNull();
  });
});

describe("titleFromSlug", () => {
  it("capitalizes each word", () => {
    expect(titleFromSlug("longest-substring-without-repeating-characters")).toBe(
      "Longest Substring Without Repeating Characters",
    );
  });
});

describe("parseCategories", () => {
  it("trims empty values and removes case-insensitive duplicates", () => {
    expect(parseCategories(" Array, Hash Table, array, , Two Pointers ")).toEqual([
      "Array",
      "Hash Table",
      "Two Pointers",
    ]);
  });
});

describe("AddProblemDialog on the All Problems page", () => {
  async function renderEmptyPage() {
    const db = await makeDb();
    render(
      <DbProvider db={db}>
        <AllProblemsPage onOpenProblem={() => {}} />
      </DbProvider>,
    );
    await waitFor(() => expect(screen.getByText("0 problems")).toBeInTheDocument());
  }

  it("adds a problem via URL and refreshes the table", async () => {
    await renderEmptyPage();

    await userEvent.click(screen.getByRole("button", { name: "+ New problem" }));
    expect(screen.getByRole("dialog", { name: "New problem" })).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText(/LeetCode URL or slug/),
      "https://leetcode.com/problems/two-sum/",
    );
    await userEvent.selectOptions(screen.getByLabelText("Difficulty"), "easy");
    await userEvent.type(screen.getByLabelText(/Categories/), "Array, Hash Table");
    await userEvent.click(screen.getByRole("button", { name: "Add problem" }));

    // dialog closes, table refreshes with derived title
    await waitFor(() => expect(screen.getByText("Two Sum")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Array, Hash Table")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("shows a validation error for unusable input", async () => {
    await renderEmptyPage();
    await userEvent.click(screen.getByRole("button", { name: "+ New problem" }));
    await userEvent.type(screen.getByLabelText(/LeetCode URL or slug/), "https://example.com/x");
    await userEvent.click(screen.getByRole("button", { name: "Add problem" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/URL or slug/);
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // stays open
  });

  it("cancel closes the dialog without adding", async () => {
    await renderEmptyPage();
    await userEvent.click(screen.getByRole("button", { name: "+ New problem" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("0 problems")).toBeInTheDocument();
  });
});

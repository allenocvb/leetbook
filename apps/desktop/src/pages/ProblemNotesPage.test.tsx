import {
  createNotesRepo,
  createProblemsRepo,
  createReviewsRepo,
  type SqlExecutor,
} from "@leetbook/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DbProvider } from "../db/DbContext.js";
import { makeDb, seed } from "../test-utils.js";
import { ProblemNotesPage } from "./ProblemNotesPage.js";

async function setup(withNote = false) {
  const db = await makeDb();
  await seed(db, [
    {
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "easy",
      tags: ["Array", "Hash Table"],
      scores: [4],
      firstReviewedAt: "2026-07-01T00:00:00.000Z",
    },
  ]);
  const problem = await createProblemsRepo(db).getBySlug("two-sum");
  if (!problem) throw new Error("seed failed");
  if (withNote) {
    await createNotesRepo(db).put(
      problem.id,
      JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "existing note" }] }],
      }),
      new Date(),
    );
  }
  const onBack = vi.fn();
  render(
    <DbProvider db={db}>
      <ProblemNotesPage problemId={problem.id} onBack={onBack} saveDelayMs={0} />
    </DbProvider>,
  );
  await waitFor(() => expect(screen.getByRole("heading", { name: "Two Sum" })).toBeInTheDocument());
  return { db, problem, onBack };
}

describe("ProblemNotesPage", () => {
  it("shows the metadata header", async () => {
    await setup();
    expect(screen.getByText("Easy")).toBeInTheDocument();
    expect(screen.getByText("Array, Hash Table")).toBeInTheDocument();
    expect(screen.getByText(/1 reps/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open on LeetCode/ })).toHaveAttribute(
      "href",
      "https://leetcode.com/problems/two-sum/",
    );
  });

  it("loads an existing note into the editor", async () => {
    await setup(true);
    expect(screen.getByText("existing note")).toBeInTheDocument();
  });

  it("autosaves edits to the notes repo", async () => {
    const { db, problem } = await setup();
    const editor = document.querySelector(".note-editor .ProseMirror") as HTMLElement;
    await userEvent.click(editor);
    await userEvent.keyboard("hash map trick");

    await waitFor(async () => {
      const saved = await createNotesRepo(db as SqlExecutor).get(problem.id);
      expect(saved?.contentJson).toContain("hash map trick");
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("back button returns to the table", async () => {
    const { onBack } = await setup();
    await userEvent.click(screen.getByRole("button", { name: "← All Problems" }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe("code snapshot", () => {
  it("shows the latest captured solution with metadata", async () => {
    const db = await makeDb();
    await seed(db, [{ slug: "two-sum", title: "Two Sum" }]);
    const problem = await createProblemsRepo(db).getBySlug("two-sum");
    if (!problem) throw new Error("seed failed");
    await createReviewsRepo(db).add({
      problemId: problem.id,
      score: 4,
      reviewedAt: "2026-07-21T00:00:00.000Z",
      runtimeMs: 61,
      memoryMb: 18.4,
      language: "python3",
      codeSnapshot: "def twoSum(self, nums, target): ...",
    });

    render(
      <DbProvider db={db}>
        <ProblemNotesPage problemId={problem.id} onBack={() => {}} saveDelayMs={0} />
      </DbProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Latest solution snapshot" })).toBeInTheDocument(),
    );
    expect(screen.getByText("def twoSum(self, nums, target): ...")).toBeInTheDocument();
    expect(screen.getByText(/python3 · snapshot · Jul 21 · 61 ms · 18.4 MB/)).toBeInTheDocument();
  });

  it("renders nothing when no review has a snapshot", async () => {
    await setup(); // seeded review has no codeSnapshot
    expect(
      screen.queryByRole("region", { name: "Latest solution snapshot" }),
    ).not.toBeInTheDocument();
  });
});

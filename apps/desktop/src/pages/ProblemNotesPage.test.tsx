import {
  createNotesRepo,
  createProblemsRepo,
  createReviewsRepo,
  createSchedulingRepo,
  type SqlExecutor,
} from "@leetbook/core";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { formatDueDate, formatNoteDate } from "../components/notes/ProblemNotesHeader.js";
import { DbProvider } from "../db/DbContext.js";
import { makeDb, seed } from "../test-utils.js";
import { ProblemNotesPage } from "./ProblemNotesPage.js";

async function setup(withNote = false, saveDelayMs = 0) {
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
  const view = render(
    <DbProvider db={db}>
      <ProblemNotesPage problemId={problem.id} onBack={onBack} saveDelayMs={saveDelayMs} />
    </DbProvider>,
  );
  await waitFor(() => expect(screen.getByRole("heading", { name: "Two Sum" })).toBeInTheDocument());
  return { db, problem, onBack, ...view };
}

describe("ProblemNotesPage", () => {
  it("shows the final metadata header with derived score, reps, and category chips", async () => {
    await setup();
    expect(screen.getByText("Easy")).toBeInTheDocument();
    expect(screen.getByText("Array")).toHaveClass("problem-notes-header__chip");
    expect(screen.getByText("Hash Table")).toHaveClass("problem-notes-header__chip");
    expect(screen.getByText("Jul 1, 2026 · scored 4 · 1 reps")).toBeInTheDocument();
    expect(screen.getByText("Next review").nextElementSibling).toHaveClass(
      "problem-notes-header__next",
    );
    expect(screen.queryByText("Runtime")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open on LeetCode/ })).toHaveClass(
      "ui-button--outline",
    );
    expect(screen.getByRole("button", { name: "Edit problem" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log review" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review history" })).toBeInTheDocument();
    expect(screen.getByText("1 review")).toBeInTheDocument();
    expect(screen.getByText("Hesitant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit latest review" })).toBeInTheDocument();
  });

  it("logs a review for an unscheduled problem and refreshes every derived field", async () => {
    const db = await makeDb();
    await seed(db, [{ slug: "valid-anagram", title: "Valid Anagram", tags: ["Hash Table"] }]);
    const problem = await createProblemsRepo(db).getBySlug("valid-anagram");
    if (!problem) throw new Error("seed failed");

    render(
      <DbProvider db={db}>
        <ProblemNotesPage problemId={problem.id} onBack={() => {}} saveDelayMs={0} />
      </DbProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Valid Anagram" })).toBeInTheDocument(),
    );
    expect(screen.getByText("Not reviewed yet")).toBeInTheDocument();
    expect(screen.getByText("No reviews logged yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit latest review" })).not.toBeInTheDocument();
    expect(await createSchedulingRepo(db).get(problem.id)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Log review" }));
    const dialog = screen.getByRole("dialog", { name: "Log review" });
    const submit = within(dialog).getByRole("button", { name: "Log review" });
    expect(submit).toBeDisabled();

    await userEvent.keyboard("5");
    expect(within(dialog).getByRole("button", { name: "5 Perfect" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(dialog).getByText(/Perfect recall/)).toBeInTheDocument();
    await userEvent.click(submit);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const reviews = await createReviewsRepo(db).listByProblem(problem.id);
    const scheduling = await createSchedulingRepo(db).get(problem.id);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.score).toBe(5);
    expect(scheduling?.reviewCount).toBe(1);
    expect(scheduling?.lastReviewedAt).toBe(reviews[0]?.reviewedAt);
    expect(screen.getByText(/scored 5 · 1 reps/)).toBeInTheDocument();
    expect(screen.getByText("Next review").nextElementSibling).toHaveTextContent(/in \d+ days/);
  });

  it("corrects only the latest score and refreshes history and scheduling", async () => {
    const { db, problem } = await setup();
    const reviewsBefore = await createReviewsRepo(db).listByProblem(problem.id);
    const schedulingBefore = await createSchedulingRepo(db).get(problem.id);

    await userEvent.click(screen.getByRole("button", { name: "Edit latest review" }));
    const dialog = screen.getByRole("dialog", { name: "Edit latest review" });
    expect(within(dialog).getByRole("button", { name: "4 Hesitant" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const submit = within(dialog).getByRole("button", { name: "Save changes" });
    expect(submit).toBeDisabled();

    await userEvent.click(within(dialog).getByRole("button", { name: "0 Blackout" }));
    await userEvent.click(submit);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const reviewsAfter = await createReviewsRepo(db).listByProblem(problem.id);
    const schedulingAfter = await createSchedulingRepo(db).get(problem.id);
    expect(reviewsAfter).toHaveLength(1);
    expect(reviewsAfter[0]).toMatchObject({ id: reviewsBefore[0]?.id, score: 0 });
    expect(schedulingAfter?.reviewCount).toBe(1);
    expect(schedulingAfter?.dueAt).not.toBe(schedulingBefore?.dueAt);
    expect(screen.getByText(/scored 0 · 1 reps/)).toBeInTheDocument();
    expect(screen.getByText("Blackout")).toBeInTheDocument();
  });

  it("edits the latest review's date and rep count, not just its score", async () => {
    const { db, problem } = await setup();

    await userEvent.click(screen.getByRole("button", { name: "Edit latest review" }));
    const dialog = screen.getByRole("dialog", { name: "Edit latest review" });

    const date = within(dialog).getByLabelText("Last review");
    await userEvent.clear(date);
    await userEvent.type(date, "2026-06-15");

    const reps = within(dialog).getByLabelText("Reps");
    await userEvent.clear(reps);
    await userEvent.type(reps, "6");

    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const scheduling = await createSchedulingRepo(db).get(problem.id);
    const reviews = await createReviewsRepo(db).listByProblem(problem.id);
    expect(scheduling?.lastReviewedAt?.slice(0, 10)).toBe("2026-06-15");
    // Reps is an explicit override of stored FSRS state, so no rows are fabricated.
    expect(scheduling?.reviewCount).toBe(6);
    expect(reviews).toHaveLength(1);
    expect(screen.getByText(/scored 4 · 6 reps/)).toBeInTheDocument();
  });

  it("opens LeetCode through the browser fallback outside Tauri", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await setup();
    await userEvent.click(screen.getByRole("button", { name: /Open on LeetCode/ }));

    expect(open).toHaveBeenCalledWith(
      "https://leetcode.com/problems/two-sum/",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });

  it("loads an existing note into the editor", async () => {
    await setup(true);
    expect(screen.getByText("existing note")).toBeInTheDocument();
  });

  it("edits metadata in place while preserving notes and derived review data", async () => {
    const { db, problem } = await setup(true);
    const scheduleBefore = await createSchedulingRepo(db).get(problem.id);
    const reviewsBefore = await createReviewsRepo(db).listByProblem(problem.id);
    const noteBefore = await createNotesRepo(db).get(problem.id);

    await userEvent.click(screen.getByRole("button", { name: "Edit problem" }));
    expect(screen.getByRole("dialog", { name: "Edit problem" })).toBeInTheDocument();

    const url = screen.getByLabelText("LeetCode URL or slug");
    await userEvent.clear(url);
    await userEvent.type(url, "two-sum-ii");
    const title = screen.getByLabelText(/Title/);
    await userEvent.clear(title);
    await userEvent.type(title, "Two Sum II");
    await userEvent.selectOptions(screen.getByLabelText("Difficulty"), "medium");
    // Remove the seeded chips, then pick replacements from the canonical list.
    await userEvent.click(screen.getByRole("button", { name: "Remove Array" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove Hash Table" }));
    const categories = screen.getByLabelText(/Categories/);
    await userEvent.selectOptions(categories, "Array");
    await userEvent.selectOptions(categories, "Two Pointers");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Two Sum II" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Array")).toHaveClass("problem-notes-header__chip");
    expect(screen.getByText("Two Pointers")).toHaveClass("problem-notes-header__chip");

    expect(await createProblemsRepo(db).getById(problem.id)).toMatchObject({
      id: problem.id,
      slug: "two-sum-ii",
      title: "Two Sum II",
      url: "https://leetcode.com/problems/two-sum-ii/",
      difficulty: "medium",
      tags: ["Array", "Two Pointers"],
    });
    expect(await createProblemsRepo(db).getBySlug("two-sum")).toBeNull();
    expect(await createSchedulingRepo(db).get(problem.id)).toEqual(scheduleBefore);
    expect(await createReviewsRepo(db).listByProblem(problem.id)).toEqual(reviewsBefore);
    expect(await createNotesRepo(db).get(problem.id)).toEqual(noteBefore);
  });

  it("autosaves edits to the notes repo", async () => {
    const { db, problem } = await setup(false, 50);
    const editor = document.querySelector(".note-editor .ProseMirror") as HTMLElement;
    await userEvent.click(editor);
    await userEvent.keyboard("hash map trick");

    expect(screen.getByText("Saving…")).toBeInTheDocument();
    await waitFor(async () => {
      const saved = await createNotesRepo(db as SqlExecutor).get(problem.id);
      expect(saved?.contentJson).toContain("hash map trick");
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("flushes the latest pending note when navigating away", async () => {
    const { db, problem, unmount } = await setup(false, 60_000);
    const editor = document.querySelector(".note-editor .ProseMirror") as HTMLElement;
    await userEvent.click(editor);
    await userEvent.keyboard("leave safely");
    unmount();

    await waitFor(async () => {
      const saved = await createNotesRepo(db as SqlExecutor).get(problem.id);
      expect(saved?.contentJson).toContain("leave safely");
    });
  });

  it("back button returns to the table", async () => {
    const { onBack } = await setup();
    await userEvent.click(screen.getByRole("button", { name: "← All Problems" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("deletes a problem only after confirmation, then returns to the table", async () => {
    const { db, problem, onBack } = await setup(true);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    // The first click only arms the action; nothing is gone yet.
    expect(await createProblemsRepo(db).getById(problem.id)).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(await createProblemsRepo(db).getById(problem.id)).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    // The confirm button names its target, so it is unambiguous to both tests and readers.
    await userEvent.click(screen.getByRole("button", { name: "Delete Two Sum" }));

    await waitFor(() => expect(onBack).toHaveBeenCalled());
    expect(await createProblemsRepo(db).getById(problem.id)).toBeNull();
    // Derived rows go with it rather than lingering as orphans.
    expect(await createReviewsRepo(db).listByProblem(problem.id)).toEqual([]);
    expect(await createSchedulingRepo(db).get(problem.id)).toBeNull();
    expect(await createNotesRepo(db).get(problem.id)).toBeNull();
  });

  it("does not resurrect the note of a deleted problem via autosave", async () => {
    const { db, problem, onBack } = await setup(true, 1000);

    // Type first so a save is queued, then delete before the debounce fires.
    await userEvent.click(screen.getByRole("textbox", { name: "Problem notes" }));
    await userEvent.keyboard("pending edit");

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Two Sum" }));
    await waitFor(() => expect(onBack).toHaveBeenCalled());

    cleanup(); // unmount runs the autosave flush
    await waitFor(async () => {
      expect(await createNotesRepo(db).get(problem.id)).toBeNull();
    });
  });
});

describe("code snapshot", () => {
  it("shows the latest captured solution and latest available runtime metadata", async () => {
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
    await createReviewsRepo(db).add({
      problemId: problem.id,
      score: 5,
      reviewedAt: "2026-07-22T00:00:00.000Z",
      runtimeMs: null,
      memoryMb: null,
      language: null,
      codeSnapshot: null,
    });

    render(
      <DbProvider db={db}>
        <ProblemNotesPage problemId={problem.id} onBack={() => {}} saveDelayMs={0} />
      </DbProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Latest solution snapshot" })).toBeInTheDocument(),
    );
    const snapshot = screen.getByRole("region", { name: "Latest solution snapshot" });
    expect(snapshot.querySelector("code")).toHaveTextContent("def twoSum(self, nums, target): ...");
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("snapshot · Jul 21")).toBeInTheDocument();
    expect(snapshot.querySelector(".hljs-keyword")).toHaveTextContent("def");
    expect(snapshot).not.toContainElement(screen.queryByRole("combobox"));
    expect(screen.getByText("61 ms · 18.4 MB")).toBeInTheDocument();
    expect(screen.getByText("Jul 22, 2026 · scored 5 · 2 reps")).toBeInTheDocument();
  });

  it("renders nothing when no review has a snapshot", async () => {
    await setup(); // seeded review has no codeSnapshot
    expect(
      screen.queryByRole("region", { name: "Latest solution snapshot" }),
    ).not.toBeInTheDocument();
  });
});

describe("notes metadata formatting", () => {
  it("uses stable full dates and calendar-day due labels", () => {
    expect(formatNoteDate("2026-07-28T18:00:00.000Z")).toBe("Jul 28, 2026");
    expect(formatDueDate("2026-07-28T18:00:00.000Z", new Date("2026-07-25T23:00:00.000Z"))).toBe(
      "Jul 28, 2026 · in 3 days",
    );
    expect(formatDueDate("2026-07-25T00:00:00.000Z", new Date("2026-07-26T01:00:00.000Z"))).toBe(
      "Jul 25, 2026 · 1 day overdue",
    );
  });
});

import { createReviewsRepo, createSchedulingRepo, listDueRows } from "@leetbook/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DbProvider } from "../db/DbContext.js";
import { makeDb, seed } from "../test-utils.js";
import { ReviewSessionPage } from "./ReviewSessionPage.js";

async function setup(problems = 2) {
  const db = await makeDb();
  const specs = [
    {
      slug: "old-fail",
      title: "Old Fail",
      scores: [0 as const],
      firstReviewedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      slug: "old-hard",
      title: "Old Hard",
      scores: [2 as const],
      firstReviewedAt: "2026-01-01T00:00:00.000Z",
    },
  ].slice(0, problems);
  await seed(db, specs);
  const onExit = vi.fn();
  render(
    <DbProvider db={db}>
      <ReviewSessionPage onExit={onExit} />
    </DbProvider>,
  );
  return { db, onExit };
}

describe("ReviewSessionPage", () => {
  it("shows one due problem at a time with progress", async () => {
    await setup();
    await waitFor(() => expect(screen.getByText("1 of 2")).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("How well did you recall it?")).toBeInTheDocument();
    // rubric prompt visible before any selection
    expect(screen.getByText("Rate your recall: 0–5.")).toBeInTheDocument();
  });

  it("selecting a score shows its rubric line and a schedule preview", async () => {
    await setup();
    await waitFor(() => expect(screen.getByText("1 of 2")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /3 Struggled/ }));
    expect(screen.getByText(/3 — Correct, but with significant effort/)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText(/Struggled → Good · due in \d+ days? · Enter to confirm/),
      ).toBeInTheDocument(),
    );
  });

  it("opens the current problem through the browser fallback outside Tauri", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await setup(1);
    await waitFor(() => expect(screen.getByText("1 of 1")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Open on LeetCode/ }));

    expect(open).toHaveBeenCalledWith(
      "https://leetcode.com/problems/old-fail/",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });

  it("confirming applies the review and advances; finishing shows the summary", async () => {
    const { db } = await setup();
    await waitFor(() => expect(screen.getByText("1 of 2")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /4 Hesitant/ }));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByText("2 of 2")).toBeInTheDocument());

    await userEvent.keyboard("1");
    await waitFor(() =>
      expect(screen.getByText(/1 — Incorrect, but the approach/)).toBeInTheDocument(),
    );
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByText("Session complete")).toBeInTheDocument());
    expect(screen.getByText(/2 reviewed · 1 recalled · 1 to re-study/)).toBeInTheDocument();

    // both problems rescheduled into the future → no longer due
    expect(await listDueRows(db, new Date().toISOString())).toHaveLength(0);
    const scheduling = createSchedulingRepo(db);
    const reviews = createReviewsRepo(db);
    const due = await listDueRows(db, "2100-01-01T00:00:00.000Z");
    expect(due).toHaveLength(2);
    for (const row of due) {
      expect((await scheduling.get(row.problemId))?.reviewCount).toBe(2);
      expect(await reviews.listByProblem(row.problemId)).toHaveLength(2);
    }
  });

  it("Enter without a selected score does nothing", async () => {
    await setup();
    await waitFor(() => expect(screen.getByText("1 of 2")).toBeInTheDocument());
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });

  it("Escape exits the session", async () => {
    const { onExit } = await setup();
    await waitFor(() => expect(screen.getByText("1 of 2")).toBeInTheDocument());
    await userEvent.keyboard("{Escape}");
    expect(onExit).toHaveBeenCalled();
  });

  it("shows the empty state when nothing is due", async () => {
    const db = await makeDb();
    await seed(db, [{ slug: "fresh", title: "Fresh" }]); // never reviewed → not due
    render(
      <DbProvider db={db}>
        <ReviewSessionPage onExit={() => {}} />
      </DbProvider>,
    );
    await waitFor(() => expect(screen.getByText("Nothing due")).toBeInTheDocument());
  });
});

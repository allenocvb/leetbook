import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DbProvider } from "../db/DbContext.js";
import { makeDb, seed } from "../test-utils.js";
import { DueTodayPage } from "./DueTodayPage.js";

async function renderPage({ designDue = 0, onReviewDesign = vi.fn() } = {}) {
  const db = await makeDb();
  await seed(db, [
    { slug: "two-sum", title: "Two Sum", scores: [3], firstReviewedAt: "2020-01-01T00:00:00.000Z" },
  ]);
  render(
    <DbProvider db={db}>
      <DueTodayPage onOpenProblem={vi.fn()} designDue={designDue} onReviewDesign={onReviewDesign} />
    </DbProvider>,
  );
  await waitFor(() => expect(screen.getByRole("heading", { name: "Due Today" })).toBeVisible());
  return { db, onReviewDesign };
}

describe("DueTodayPage", () => {
  it("says nothing about design when no topic is due", async () => {
    await renderPage({ designDue: 0 });
    expect(screen.queryByRole("button", { name: "Review design" })).not.toBeInTheDocument();
  });

  /*
   * Design topics are not mixed into the problem table — half its columns do not apply — but
   * a schedule that hides what is due is worse than no schedule, so they get a banner.
   */
  it("surfaces due design topics above the problems table", async () => {
    await renderPage({ designDue: 3 });

    expect(screen.getByText(/system design topics are also due/)).toBeInTheDocument();
    // The problems table is still the main content.
    expect(screen.getByText("Two Sum")).toBeInTheDocument();
  });

  it("uses the singular for one topic", async () => {
    await renderPage({ designDue: 1 });
    expect(screen.getByText(/system design topic is also due/)).toBeInTheDocument();
  });

  it("starts a design review from the banner", async () => {
    const { onReviewDesign } = await renderPage({ designDue: 2 });

    await userEvent.click(screen.getByRole("button", { name: "Review design" }));

    expect(onReviewDesign).toHaveBeenCalled();
  });
});

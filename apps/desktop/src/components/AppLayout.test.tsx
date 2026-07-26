import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App.js";
import { makeDb, seed } from "../test-utils.js";
import { NAV_ITEMS } from "./Sidebar.js";

async function renderApp({ skipIntro = true }: { skipIntro?: boolean } = {}) {
  const db = await makeDb();
  await seed(db, [
    // reviewed long ago with a failing score → due now
    {
      slug: "old-fail",
      title: "Old Fail",
      tags: ["Array"],
      scores: [0],
      firstReviewedAt: "2026-01-01T00:00:00.000Z",
    },
    { slug: "untouched", title: "Untouched", tags: ["Graphs"] },
  ]);
  render(<App db={db} />);
  // The intro now opens on every launch, so tests that need a view click through it.
  if (skipIntro) {
    await userEvent.click(await screen.findByRole("button", { name: "Le(e)t's Code" }));
    await waitFor(() => expect(screen.getByText("Old Fail")).toBeInTheDocument());
  }
}

describe("App shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens the intro on every launch with live counts", async () => {
    await renderApp({ skipIntro: false });

    expect(screen.getByRole("heading", { name: "LeetBook" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("2 problems · 1 due today")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Le(e)t's Code" }));
    expect(screen.getByRole("heading", { name: "All Problems" })).toBeInTheDocument();

    // Nothing is persisted: a fresh launch shows it again rather than remembering.
    cleanup();
    await renderApp({ skipIntro: false });
    expect(screen.getByRole("button", { name: "Le(e)t's Code" })).toBeInTheDocument();
  });

  it("renders the sidebar with every nav item", async () => {
    await renderApp();
    for (const item of NAV_ITEMS) {
      expect(
        screen.getByRole("button", { name: new RegExp(item.label.slice(0, 7), "i") }),
      ).toBeInTheDocument();
    }
  });

  it("starts on All Problems and shows live counts", async () => {
    await renderApp();
    expect(screen.getByRole("heading", { name: "All Problems" })).toBeInTheDocument();
    await waitFor(() => {
      // all = 2, due = 1 (badges in the sidebar)
      expect(screen.getByRole("button", { name: /All Problems 2/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Due Today 1/ })).toBeInTheDocument();
    });
    expect(screen.getByText("Listener offline")).toBeInTheDocument();
  });

  it("filters the table from sidebar categories and clears on a second click", async () => {
    await renderApp();
    const category = await screen.findByRole("button", { name: "Array 1" });

    await userEvent.click(category);
    expect(screen.getByText("Old Fail")).toBeInTheDocument();
    expect(screen.queryByText("Untouched")).not.toBeInTheDocument();
    expect(category).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(category);
    await waitFor(() => expect(screen.getByText("Untouched")).toBeInTheDocument());
    expect(category).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps category filtering inside the Due Today view", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Due Today/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Graphs 1" }));

    expect(
      screen.getByText("Nothing here yet — nothing due in this category."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Untouched")).not.toBeInTheDocument();
  });

  it("navigates to Due Today, which lists only due problems", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Due Today/ }));
    expect(screen.getByRole("heading", { name: "Due Today" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Old Fail")).toBeInTheDocument());
    expect(screen.queryByText("Untouched")).not.toBeInTheDocument();
  });

  it("switches All Problems and Due Today from the table tabs", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("tab", { name: "Due Today" }));

    expect(screen.getByRole("heading", { name: "Due Today" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Due Today" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByText("Old Fail")).toBeInTheDocument());
    expect(screen.queryByText("Untouched")).not.toBeInTheDocument();
  });

  it("opens problem notes in the flush scrolling pane", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: "Open notes for Old Fail" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Old Fail" })).toBeInTheDocument(),
    );
    expect(document.querySelector(".app-layout__main")).toHaveClass("app-layout__main--flush");
    expect(document.querySelector(".problem-notes-page__content")).toBeInTheDocument();
  });

  it("navigates to the review session, which picks up the due problem", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Review Session/ }));
    await waitFor(() => expect(screen.getByText("1 of 1")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Old Fail" })).toBeInTheDocument();
    expect(document.querySelector(".app-layout__main")).toHaveClass("app-layout__main--flush");
  });

  it("opens the current problem notes from the review session", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Review Session/ }));
    await waitFor(() => expect(screen.getByText("1 of 1")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Show my notes" }));

    await waitFor(() =>
      expect(document.querySelector(".problem-notes-page__content")).toBeVisible(),
    );
    expect(screen.getByRole("heading", { name: "Old Fail" })).toBeInTheDocument();
  });

  it("has no Capture nav item — its state and setup live in Settings", async () => {
    await renderApp();
    expect(screen.queryByRole("button", { name: /Capture/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Settings & Pairing/ }));
    expect(screen.getByText("Set up automatic capture")).toBeInTheDocument();
    expect(screen.getByText("Listener")).toBeInTheDocument();
    expect(screen.getByText("Paired extension")).toBeInTheDocument();
  });

  it("navigates to the final settings cards", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Settings & Pairing/ }));

    expect(screen.getByRole("heading", { name: "Settings & Pairing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scheduling" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Data" })).toBeInTheDocument();
    expect(await screen.findByText(/Local SQLite · 2 problems/)).toBeInTheDocument();
  });
});

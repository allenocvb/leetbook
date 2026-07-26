import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App.js";
import { makeDb, seed } from "../test-utils.js";
import { NAV_ITEMS } from "./Sidebar.js";

async function renderApp() {
  const db = await makeDb();
  await seed(db, [
    // reviewed long ago with a failing score → due now
    {
      slug: "old-fail",
      title: "Old Fail",
      scores: [0],
      firstReviewedAt: "2026-01-01T00:00:00.000Z",
    },
    { slug: "untouched", title: "Untouched" },
  ]);
  render(<App db={db} />);
  await waitFor(() => expect(screen.getByText("Old Fail")).toBeInTheDocument());
}

describe("App shell", () => {
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
  });

  it("navigates to Due Today, which lists only due problems", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Due Today/ }));
    expect(screen.getByRole("heading", { name: "Due Today" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Old Fail")).toBeInTheDocument());
    expect(screen.queryByText("Untouched")).not.toBeInTheDocument();
  });

  it("navigates to the review session, which picks up the due problem", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Review Session/ }));
    await waitFor(() => expect(screen.getByText("1 of 1")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Old Fail" })).toBeInTheDocument();
  });

  it("navigates to placeholder pages", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Capture/ }));
    expect(screen.getByRole("heading", { name: "Capture" })).toBeInTheDocument();
  });
});

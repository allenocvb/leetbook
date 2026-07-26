import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App.js";
import { NAV_ITEMS } from "./Sidebar.js";

describe("App shell", () => {
  it("renders the sidebar with every nav item", () => {
    render(<App />);
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("button", { name: item.label })).toBeInTheDocument();
    }
  });

  it("starts on All Problems", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "All Problems" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All Problems/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("navigates between views from the sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Due Today/i }));
    expect(screen.getByRole("heading", { name: "Due Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Due Today/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("heading", { name: "All Problems" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Review Session/i }));
    expect(screen.getByRole("heading", { name: "Review Session" })).toBeInTheDocument();
  });
});

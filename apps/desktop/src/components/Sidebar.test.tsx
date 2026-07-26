import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar.js";

const categories = [
  { name: "Array", count: 12 },
  { name: "Graphs", count: 4 },
];

describe("Sidebar", () => {
  it("renders the final navigation, category counts, version, and real listener state", () => {
    render(
      <Sidebar
        activeView="all-problems"
        onNavigate={() => undefined}
        counts={{ "all-problems": 47, "due-today": 5 }}
        categories={categories}
        activeCategory="Array"
        listener={{ state: "listening", port: 7749 }}
      />,
    );

    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All Problems 47" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Due Today 5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Array 12" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Capture listener status")).toHaveTextContent(
      "Listener ready:7749",
    );
    expect(screen.queryByText("Extension connected")).not.toBeInTheDocument();
  });

  it("reports an offline listener without claiming an extension connection", () => {
    render(
      <Sidebar
        activeView="settings"
        onNavigate={() => undefined}
        listener={{ state: "offline", port: null }}
      />,
    );

    expect(screen.getByLabelText("Capture listener status")).toHaveTextContent("Listener offline—");
  });

  it("sends navigation and category selections to the shell", async () => {
    const onNavigate = vi.fn();
    const onPickCategory = vi.fn();
    const user = userEvent.setup();
    render(
      <Sidebar
        activeView="all-problems"
        onNavigate={onNavigate}
        categories={categories}
        onPickCategory={onPickCategory}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Review Session" }));
    await user.click(screen.getByRole("button", { name: "Graphs 4" }));

    expect(onNavigate).toHaveBeenCalledWith("review");
    expect(onPickCategory).toHaveBeenCalledWith("Graphs");
  });
});

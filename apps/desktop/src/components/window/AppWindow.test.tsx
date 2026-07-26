import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "../../theme/ThemeProvider.js";
import { AppWindow } from "./AppWindow.js";

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("AppWindow", () => {
  it("renders the titlebar and application content", () => {
    const { container } = render(
      <ThemeProvider>
        <AppWindow>
          <p>Notebook content</p>
        </AppWindow>
      </ThemeProvider>,
    );

    expect(screen.getByText("LeetBook")).toBeInTheDocument();
    expect(screen.getByText("Notebook content")).toBeInTheDocument();
    expect(container.querySelectorAll(".titlebar__traffic-lights button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Close window" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimize window" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maximize window" })).toBeInTheDocument();
    expect(container.querySelector(".titlebar")).toHaveAttribute("data-tauri-drag-region");
  });

  it("keeps the persisted theme control in the titlebar", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <AppWindow>Content</AppWindow>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });
});

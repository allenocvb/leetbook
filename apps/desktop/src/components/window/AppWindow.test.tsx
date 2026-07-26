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
    // macOS draws the window controls itself; the app must not render its own.
    expect(container.querySelector(".titlebar__traffic-lights")).toBeNull();
    expect(screen.queryByRole("button", { name: /window|full screen/i })).toBeNull();
    expect(container.querySelector(".titlebar")).toHaveAttribute("data-tauri-drag-region");
  });

  it("fills the OS window instead of drawing a simulated window inside it", () => {
    const { container } = render(
      <ThemeProvider>
        <AppWindow>Content</AppWindow>
      </ThemeProvider>,
    );

    // The Tauri window is undecorated and already sized to the reference viewport,
    // so a desk-stage wrapper would render a second window inside the real one.
    expect(container.querySelector(".window-stage")).toBeNull();
    expect(container.firstElementChild).toHaveClass("app-window");
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

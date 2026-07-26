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
    expect(screen.getByRole("button", { name: "Toggle full screen" })).toBeInTheDocument();
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

  it("orders the traffic lights close, minimize, maximize", () => {
    const { container } = render(
      <ThemeProvider>
        <AppWindow>Content</AppWindow>
      </ThemeProvider>,
    );

    // The hover colors are assigned by :nth-child, so this order is load-bearing.
    const labels = [...container.querySelectorAll(".titlebar__traffic-lights button")].map(
      (button) => button.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["Close window", "Minimize window", "Toggle full screen"]);
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

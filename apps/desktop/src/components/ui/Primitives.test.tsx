import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "../../theme/ThemeProvider.js";
import { Button } from "./Button.js";
import { Divider } from "./Divider.js";
import { LogoMark } from "./LogoMark.js";
import { ThemeToggle } from "./ThemeToggle.js";

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("shared UI primitives", () => {
  it("renders button variants, logo, and divider", () => {
    const { container } = render(
      <>
        <Button>Save</Button>
        <Button variant="outline">Cancel</Button>
        <LogoMark size={54} />
        <Divider />
      </>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("ui-button--primary");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("ui-button--outline");
    expect(container.querySelector(".ui-logo")).toHaveStyle("--logo-size: 54px");
    expect(container.querySelector("hr")).toHaveClass("ui-divider");
  });

  it("toggles the persisted theme", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toHaveTextContent("Dark");
  });
});

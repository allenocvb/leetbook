import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ProblemDialog } from "./ProblemDialog.js";

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <ProblemDialog title="Keyboard dialog" onClose={() => setOpen(false)}>
          {/* biome-ignore lint/a11y/noAutofocus: exercises the real form-dialog focus behavior */}
          <button type="button" autoFocus>
            First
          </button>
          <button type="button">Last</button>
        </ProblemDialog>
      )}
    </>
  );
}

describe("ProblemDialog", () => {
  it("contains keyboard focus and restores it after Escape", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Open" });

    await user.click(trigger);
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

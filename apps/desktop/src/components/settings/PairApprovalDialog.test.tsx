import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PairApprovalDialog } from "./PairApprovalDialog.js";

const PROMPT = { id: "req-1", code: "K4TQ" };

describe("PairApprovalDialog", () => {
  it("shows the code so the user can match it against the extension", () => {
    render(<PairApprovalDialog prompt={PROMPT} onResolve={vi.fn(async () => {})} />);

    expect(
      screen.getByRole("dialog", { name: "Allow LeetBook Capture to connect?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("K4TQ")).toBeInTheDocument();
  });

  it("approves and denies explicitly", async () => {
    const onResolve = vi.fn(async () => {});
    const { rerender } = render(<PairApprovalDialog prompt={PROMPT} onResolve={onResolve} />);

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onResolve).toHaveBeenCalledWith(true);

    rerender(<PairApprovalDialog prompt={PROMPT} onResolve={onResolve} />);
    await userEvent.click(screen.getByRole("button", { name: "Deny" }));
    expect(onResolve).toHaveBeenCalledWith(false);
  });

  it("treats dismissing the dialog as a denial rather than silently pairing", async () => {
    const onResolve = vi.fn(async () => {});
    render(<PairApprovalDialog prompt={PROMPT} onResolve={onResolve} />);

    await userEvent.keyboard("{Escape}");
    expect(onResolve).toHaveBeenCalledWith(false);
  });
});

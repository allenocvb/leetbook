import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExternalLinkButton } from "./ExternalLinkButton.js";

describe("ExternalLinkButton", () => {
  it("opens its URL through the shared opener", async () => {
    const opener = vi.fn().mockResolvedValue(undefined);
    render(
      <ExternalLinkButton url="https://leetcode.com/problems/two-sum/" opener={opener}>
        Open on LeetCode ↗
      </ExternalLinkButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open on LeetCode ↗" }));
    expect(opener).toHaveBeenCalledWith("https://leetcode.com/problems/two-sum/");
  });

  it("reports opener failures without an unhandled rejection", async () => {
    const opener = vi.fn().mockRejectedValue(new Error("denied"));
    render(
      <ExternalLinkButton url="https://leetcode.com/problems/two-sum/" opener={opener}>
        Open on LeetCode ↗
      </ExternalLinkButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open on LeetCode ↗" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t open LeetCode.");
  });
});

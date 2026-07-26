import { describe, expect, it, vi } from "vitest";
import {
  type ExternalLinkAdapters,
  openLeetCodeUrl,
  validateLeetCodeUrl,
} from "./externalLinks.js";

function adapters(tauri: boolean) {
  const value: ExternalLinkAdapters = {
    isTauri: () => tauri,
    openInTauri: vi.fn().mockResolvedValue(undefined),
    openInBrowser: vi.fn(),
  };
  return value;
}

describe("validateLeetCodeUrl", () => {
  it("accepts canonical problem URLs", () => {
    expect(validateLeetCodeUrl("https://leetcode.com/problems/two-sum/")).toBe(
      "https://leetcode.com/problems/two-sum/",
    );
    expect(validateLeetCodeUrl("https://www.leetcode.com/problems/two-sum/description/")).toBe(
      "https://www.leetcode.com/problems/two-sum/description/",
    );
  });

  it.each([
    "not a url",
    "http://leetcode.com/problems/two-sum/",
    "https://example.com/problems/two-sum/",
    "https://leetcode.com/discuss/general-discussion/",
    "https://leetcode.com:444/problems/two-sum/",
  ])("rejects unsafe or non-problem URL %s", (url) => {
    expect(() => validateLeetCodeUrl(url)).toThrow(/Invalid LeetCode/);
  });
});

describe("openLeetCodeUrl", () => {
  it("uses the Tauri platform opener inside the desktop shell", async () => {
    const platform = adapters(true);
    await openLeetCodeUrl("https://leetcode.com/problems/two-sum/", platform);

    expect(platform.openInTauri).toHaveBeenCalledWith("https://leetcode.com/problems/two-sum/");
    expect(platform.openInBrowser).not.toHaveBeenCalled();
  });

  it("uses a browser-safe new window outside Tauri", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await openLeetCodeUrl("https://leetcode.com/problems/two-sum/");

    expect(open).toHaveBeenCalledWith(
      "https://leetcode.com/problems/two-sum/",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });

  it("does not call either opener for an invalid URL", async () => {
    const platform = adapters(true);
    await expect(openLeetCodeUrl("javascript:alert(1)", platform)).rejects.toThrow(
      /Invalid LeetCode/,
    );
    expect(platform.openInTauri).not.toHaveBeenCalled();
    expect(platform.openInBrowser).not.toHaveBeenCalled();
  });
});

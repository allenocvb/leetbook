import { describe, expect, it } from "vitest";
import { formatShortDate, isDue } from "./format.js";

const NOW = new Date("2026-07-25T12:00:00.000Z");

describe("formatShortDate", () => {
  it("formats same-year dates without the year", () => {
    expect(formatShortDate("2026-07-28T00:00:00.000Z", NOW)).toBe("Jul 28");
  });

  it("includes the year for other years", () => {
    expect(formatShortDate("2025-10-15T00:00:00.000Z", NOW)).toBe("Oct 15, 2025");
  });

  it("renders a dash for null or invalid input", () => {
    expect(formatShortDate(null, NOW)).toBe("—");
    expect(formatShortDate("garbage", NOW)).toBe("—");
  });
});

describe("isDue", () => {
  it("is true at or before now, false after", () => {
    expect(isDue("2026-07-25T12:00:00.000Z", NOW)).toBe(true);
    expect(isDue("2026-01-01T00:00:00.000Z", NOW)).toBe(true);
    expect(isDue("2026-07-25T12:00:01.000Z", NOW)).toBe(false);
    expect(isDue(null, NOW)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isDifficulty, isPerformanceScore } from "./types.js";

describe("isDifficulty", () => {
  it.each(["easy", "medium", "hard"])("accepts %s", (v) => {
    expect(isDifficulty(v)).toBe(true);
  });

  it.each(["Easy", "HARD", "", "extreme", 3, null, undefined])("rejects %s", (v) => {
    expect(isDifficulty(v)).toBe(false);
  });
});

describe("isPerformanceScore", () => {
  it.each([0, 1, 2, 3, 4, 5])("accepts %i", (v) => {
    expect(isPerformanceScore(v)).toBe(true);
  });

  it.each([-1, 6, 2.5, "3", null, undefined, Number.NaN])("rejects %s", (v) => {
    expect(isPerformanceScore(v)).toBe(false);
  });
});

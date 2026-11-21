import { describe, expect, it } from "vitest";
import { mapScoreToRating, type PerformanceScore } from "./scoring.js";

describe("mapScoreToRating", () => {
  it.each([
    [0, "again"],
    [1, "again"],
    [2, "again"],
    [3, "hard"],
    [4, "good"],
    [5, "easy"],
  ] as const)("maps score %i to %s", (score, rating) => {
    expect(mapScoreToRating(score as PerformanceScore)).toBe(rating);
  });
});

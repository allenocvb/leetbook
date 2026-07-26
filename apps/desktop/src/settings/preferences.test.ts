import { describe, expect, it } from "vitest";
import {
  DAILY_NEW_LIMIT_KEY,
  DEFAULT_DAILY_NEW_LIMIT,
  readDailyNewLimit,
  writeDailyNewLimit,
} from "./preferences.js";

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(DAILY_NEW_LIMIT_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("daily new limit preference", () => {
  it("defaults to five and restores a saved value", () => {
    expect(readDailyNewLimit(memoryStorage())).toBe(DEFAULT_DAILY_NEW_LIMIT);
    expect(readDailyNewLimit(memoryStorage("12"))).toBe(12);
  });

  it("persists integers and clamps them to the supported range", () => {
    const storage = memoryStorage();
    expect(writeDailyNewLimit(99, storage)).toBe(50);
    expect(readDailyNewLimit(storage)).toBe(50);
    expect(writeDailyNewLimit(-4, storage)).toBe(0);
  });
});

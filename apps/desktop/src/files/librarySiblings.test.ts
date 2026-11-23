import { describe, expect, it } from "vitest";
import { placeBefore, stepBefore } from "./librarySiblings.js";

const item = { kind: "file" as const, id: "b" };

describe("library ordering helpers", () => {
  it("places a dropped row before or after its target", () => {
    expect(placeBefore(["a", "b", "c"], item, "c", "before")).toBe("c");
    expect(placeBefore(["a", "b", "c"], item, "a", "after")).toBe("c");
    expect(placeBefore(["a", "b", "c"], item, "c", "after")).toBeNull();
  });

  it("steps a row up or down by one, and not past either end", () => {
    expect(stepBefore(["a", "b", "c"], item, "up")).toBe("a");
    expect(stepBefore(["a", "b", "c"], item, "down")).toBeNull();
    expect(stepBefore(["a", "b", "c", "d"], item, "down")).toBe("d");
    expect(stepBefore(["b", "c"], item, "up")).toBeUndefined();
    expect(stepBefore(["a", "b"], item, "down")).toBeUndefined();
  });
});

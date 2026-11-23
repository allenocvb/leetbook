import { describe, expect, it } from "vitest";
import { dropZone } from "./rowDrop.js";

const file = (id: string) => ({ kind: "file" as const, id });
const folder = (id: string) => ({ kind: "folder" as const, id });

describe("dropZone", () => {
  it("reorders files by the half of the row under the pointer", () => {
    expect(dropZone(file("a"), file("b"), 0.2)).toBe("before");
    expect(dropZone(file("a"), file("b"), 0.8)).toBe("after");
  });

  it("moves files into folders wherever they land", () => {
    expect(dropZone(folder("f"), file("b"), 0.05)).toBe("into");
    expect(dropZone(folder("f"), file("b"), 0.95)).toBe("into");
  });

  it("reorders folders on the edges and nests them in the middle", () => {
    expect(dropZone(folder("f"), folder("g"), 0.1)).toBe("before");
    expect(dropZone(folder("f"), folder("g"), 0.5)).toBe("into");
    expect(dropZone(folder("f"), folder("g"), 0.9)).toBe("after");
  });

  it("ignores drops on the item itself and folders among files", () => {
    expect(dropZone(folder("f"), folder("f"), 0.5)).toBeNull();
    expect(dropZone(file("a"), file("a"), 0.5)).toBeNull();
    expect(dropZone(file("a"), folder("f"), 0.5)).toBeNull();
  });
});

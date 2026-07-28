import { describe, expect, it } from "vitest";
import {
  INDENT_UNIT,
  indentAfterNewline,
  lineStart,
  outdentWidth,
  shiftLines,
} from "./codeIndent.js";

describe("indentAfterNewline", () => {
  it("starts flush left in an empty block", () => {
    expect(indentAfterNewline("")).toBe("");
  });

  it("keeps the current indentation", () => {
    expect(indentAfterNewline("def f():\n    res = []")).toBe("    ");
  });

  it("steps in after a python block opener", () => {
    expect(indentAfterNewline("for i in range(100):")).toBe(INDENT_UNIT);
  });

  it("steps in from the existing level, not from zero", () => {
    expect(indentAfterNewline("def f():\n    for i in nums:")).toBe(`    ${INDENT_UNIT}`);
  });

  it("steps in after brackets and braces", () => {
    expect(indentAfterNewline("function f() {")).toBe(INDENT_UNIT);
    expect(indentAfterNewline("const xs = [")).toBe(INDENT_UNIT);
    expect(indentAfterNewline("call(")).toBe(INDENT_UNIT);
  });

  it("ignores trailing whitespace when deciding to step in", () => {
    expect(indentAfterNewline("    while l < r:   ")).toBe(`    ${INDENT_UNIT}`);
  });

  it("does not step in when the opener is mid-line", () => {
    expect(indentAfterNewline("    d = {}")).toBe("    ");
  });

  it("preserves tab indentation", () => {
    expect(indentAfterNewline("\t\tres = []")).toBe("\t\t");
  });
});

describe("outdentWidth", () => {
  it("removes nothing when already flush left", () => {
    expect(outdentWidth("res = []")).toBe(0);
  });

  it("removes a full indent unit", () => {
    expect(outdentWidth("    res = []")).toBe(INDENT_UNIT.length);
  });

  it("removes a single stray space when the indent is ragged", () => {
    expect(outdentWidth(" res = []")).toBe(1);
  });

  it("measures the caret's line, not the whole block", () => {
    expect(outdentWidth("def f():\n    res")).toBe(INDENT_UNIT.length);
  });
});

describe("lineStart", () => {
  it("points at the block start on the first line", () => {
    expect(lineStart(10, "res")).toBe(10);
  });

  it("points past the preceding newline", () => {
    expect(lineStart(10, "def f():\n    res")).toBe(19);
  });
});

describe("shiftLines", () => {
  const BLOCK = "def f():\n    a = 1\n    b = 2\nreturn";

  it("indents every line the selection touches instead of replacing it", () => {
    // Selection starting inside line 2 and ending inside line 3.
    const result = shiftLines(BLOCK, 12, 26, "in");
    expect(result.text).toBe("      a = 1\n      b = 2");
    expect(BLOCK.slice(result.from, result.to)).toBe("    a = 1\n    b = 2");
  });

  it("outdents the same range back", () => {
    const indented = "      a = 1\n      b = 2";
    expect(shiftLines(indented, 0, indented.length, "out").text).toBe("    a = 1\n    b = 2");
  });

  it("expands a partial selection to whole lines", () => {
    // Two characters in the middle of one line still indent the entire line.
    const result = shiftLines(BLOCK, 14, 16, "in");
    expect(result.from).toBe(9);
    expect(result.text).toBe("      a = 1");
  });

  it("leaves blank lines untouched rather than adding trailing whitespace", () => {
    const withBlank = "a = 1\n\nb = 2";
    expect(shiftLines(withBlank, 0, withBlank.length, "in").text).toBe("  a = 1\n\n  b = 2");
  });

  it("stops at column zero when outdenting past the margin", () => {
    const flush = "a = 1\nb = 2";
    expect(shiftLines(flush, 0, flush.length, "out").text).toBe(flush);
  });

  it("handles a selection on the first line", () => {
    const result = shiftLines(BLOCK, 0, 3, "in");
    expect(result.from).toBe(0);
    expect(result.text).toBe("  def f():");
  });
});

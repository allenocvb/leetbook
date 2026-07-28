/**
 * Indentation maths for the notes code block. Pure string helpers so the behaviour is
 * unit-testable without an editor: the extension supplies the text before the caret,
 * these decide what to insert or remove.
 */

export const INDENT_UNIT = "  ";

/** The line the caret sits on, given everything before it in the block. */
function currentLine(textBefore: string): string {
  return textBefore.slice(textBefore.lastIndexOf("\n") + 1);
}

/** Leading whitespace of the caret's line. */
function leadingWhitespace(line: string): string {
  return /^[ \t]*/.exec(line)?.[0] ?? "";
}

/**
 * True when the line opens a nested block and the next line should step in.
 * Covers Python's colon and the bracket languages; a trailing comment is rare
 * enough in a snapshot note that treating it literally is fine.
 */
function opensBlock(line: string): boolean {
  return /[:{([]$/.test(line.trimEnd());
}

/**
 * Indentation for the line created by pressing Enter. Matches the current line, and
 * steps in one level when that line opens a block — so `for i in range(100):` lands
 * the caret already indented.
 */
export function indentAfterNewline(textBefore: string): string {
  const line = currentLine(textBefore);
  const indent = leadingWhitespace(line);
  return opensBlock(line) ? indent + INDENT_UNIT : indent;
}

/**
 * How many characters Shift-Tab should remove from the start of the caret's line.
 * Removes a full indent unit when one is present, otherwise a single stray space or
 * tab, and zero when the line is already flush left.
 */
export function outdentWidth(textBefore: string): number {
  const indent = leadingWhitespace(currentLine(textBefore));
  if (indent.length === 0) return 0;
  return indent.endsWith(INDENT_UNIT) ? INDENT_UNIT.length : 1;
}

/** Document offset of the start of the caret's line, given the block's start offset. */
export function lineStart(blockStart: number, textBefore: string): number {
  return blockStart + textBefore.lastIndexOf("\n") + 1;
}

export interface ShiftedLines {
  text: string;
  /** Offsets of the replaced span, relative to the block's text. */
  from: number;
  to: number;
}

/**
 * Indent or outdent every line the selection touches, the way any code editor does.
 *
 * Tab with a selection used to replace it with two spaces — deleting whatever was
 * highlighted. Whole lines are rewritten and reselected so repeated Tab presses keep
 * working on the same block of code.
 *
 * Blank lines are left alone rather than filled with trailing whitespace.
 */
export function shiftLines(
  text: string,
  from: number,
  to: number,
  direction: "in" | "out",
): ShiftedLines {
  const start = from === 0 ? 0 : text.lastIndexOf("\n", from - 1) + 1;
  const lineEnd = text.indexOf("\n", to);
  const end = lineEnd === -1 ? text.length : lineEnd;

  const shifted = text
    .slice(start, end)
    .split("\n")
    .map((line) => {
      if (line.trim() === "") return line;
      if (direction === "in") return INDENT_UNIT + line;
      const width = outdentWidth(line);
      return width === 0 ? line : line.slice(width);
    })
    .join("\n");

  return { text: shifted, from: start, to: end };
}

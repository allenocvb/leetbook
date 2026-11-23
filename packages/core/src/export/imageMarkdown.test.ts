import { expect, it } from "vitest";
import { tiptapToMarkdown } from "./markdown.js";

it("exports embedded images with the note and escapes their labels", () => {
  expect(
    tiptapToMarkdown(
      JSON.stringify({
        type: "doc",
        content: [
          { type: "image", attrs: { src: "data:image/png;base64,aGVsbG8=", alt: "Diagram [1]" } },
        ],
      }),
    ),
  ).toBe("![Diagram \\[1\\]](data:image/png;base64,aGVsbG8=)");
});

it("omits image bytes when converting notes to text for quiz generation", () => {
  const note = JSON.stringify({
    type: "doc",
    content: [{ type: "image", attrs: { src: "data:image/png;base64,aGVsbG8=", alt: "Diagram" } }],
  });
  expect(tiptapToMarkdown(note, { includeImages: false })).toBe("[Image: Diagram]");
});

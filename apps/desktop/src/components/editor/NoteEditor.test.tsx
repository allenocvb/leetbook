import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { describe, expect, it, vi } from "vitest";
import { NOTE_PLACEHOLDER, NoteEditor } from "./NoteEditor.js";

const SAMPLE = JSON.stringify({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Intuition" }] },
    { type: "paragraph", content: [{ type: "text", text: "Use a hash map." }] },
    {
      type: "codeBlock",
      attrs: { language: "python" },
      content: [{ type: "text", text: "seen = {}" }],
    },
  ],
});

const RICH_TEXT = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "Bold" },
        { type: "text", text: ", " },
        { type: "text", marks: [{ type: "italic" }], text: "italic" },
        { type: "text", text: ", and " },
        { type: "text", marks: [{ type: "code" }], text: "inline code" },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Bullet item" }] }],
        },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 1 },
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Numbered item" }] }],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Remember the invariant." }] },
      ],
    },
  ],
});

async function renderEditor(initial: string | null, onChange = vi.fn()) {
  let editor: Editor | null = null;
  render(
    <NoteEditor
      initialContentJson={initial}
      onChange={onChange}
      onReady={(instance) => {
        editor = instance;
      }}
    />,
  );
  await waitFor(() => expect(editor).not.toBeNull());
  return { editor: editor as unknown as Editor, onChange };
}

describe("NoteEditor", () => {
  it("renders headings, paragraphs, and code blocks from stored JSON", async () => {
    await renderEditor(SAMPLE);
    expect(screen.getByText("Intuition")).toBeInTheDocument();
    expect(screen.getByText("Use a hash map.")).toBeInTheDocument();
    expect(screen.getByText(/seen = \{\}/)).toBeInTheDocument();
  });

  it("renders marks, lists, and blockquotes from stored JSON", async () => {
    await renderEditor(RICH_TEXT);
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(screen.getByText("italic").tagName).toBe("EM");
    expect(screen.getByText("inline code").tagName).toBe("CODE");
    expect(document.querySelector(".note-editor ul")).toHaveTextContent("Bullet item");
    expect(document.querySelector(".note-editor ol")).toHaveTextContent("Numbered item");
    expect(document.querySelector(".note-editor blockquote")).toHaveTextContent(
      "Remember the invariant.",
    );
  });

  it("shows the command prompt only for an empty document", async () => {
    await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    const emptyNode = surface.querySelector(".is-editor-empty");
    expect(surface).toHaveAttribute("spellcheck", "true");
    expect(emptyNode).toHaveAttribute("data-placeholder", NOTE_PLACEHOLDER);
  });

  it("applies markdown keyboard shortcuts for headings and lists", async () => {
    await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("## Intuition{Enter}- Hash map");

    expect(screen.getByRole("heading", { level: 2, name: "Intuition" })).toBeInTheDocument();
    expect(document.querySelector(".note-editor ul")).toHaveTextContent("Hash map");
  });

  it("emits serialized JSON on content changes", async () => {
    const { editor, onChange } = await renderEditor(null);
    editor.commands.insertContent("hello notes");
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const lastCall = onChange.mock.calls.at(-1)?.[0] as string;
    expect(JSON.parse(lastCall).type).toBe("doc");
    expect(lastCall).toContain("hello notes");
  });

  it("wraps non-JSON content instead of dropping it", async () => {
    await renderEditor("legacy plain text note");
    expect(screen.getByText("legacy plain text note")).toBeInTheDocument();
  });

  it("round-trips: emitted JSON renders identically when reloaded", async () => {
    const { editor, onChange } = await renderEditor(null);
    editor.commands.insertContent({
      type: "codeBlock",
      attrs: { language: "python" },
      content: [{ type: "text", text: "return []" }],
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const saved = onChange.mock.calls.at(-1)?.[0] as string;

    cleanup();
    await renderEditor(saved);
    // lowlight splits "return" into its own token span, so match the block's full text
    const code = document.querySelector(".note-editor pre code");
    expect(code?.textContent).toBe("return []");
  });
});

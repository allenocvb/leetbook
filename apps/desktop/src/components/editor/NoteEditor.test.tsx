import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { describe, expect, it, vi } from "vitest";
import { NoteEditor } from "./NoteEditor.js";

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

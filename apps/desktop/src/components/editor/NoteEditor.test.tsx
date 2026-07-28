import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { describe, expect, it, vi } from "vitest";
import { NOTE_PLACEHOLDER, NoteEditor } from "./NoteEditor.js";
import { SLASH_COMMANDS } from "./slashCommands.js";

/**
 * Text of every code block in the document. Assertions read the editor state rather than
 * the rendered DOM: the React node view's content element does not flush synchronously
 * under jsdom, so a freshly typed block still looks empty in the markup.
 */
function codeBlockTexts(editor: Editor): string[] {
  const texts: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "codeBlock") texts.push(node.textContent);
  });
  return texts;
}

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

const CALLOUT = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "callout",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Recall the shrinking-window invariant." }],
        },
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
    expect(screen.getByRole("combobox", { name: "Code language" })).toHaveValue("python");
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

  it("opens a slash menu with every supported block type", async () => {
    await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("/");

    expect(screen.getByRole("listbox", { name: "Block types" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(SLASH_COMMANDS.length);
    expect(screen.getByRole("option", { name: /Recall callout/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Code block/ })).toBeInTheDocument();
    expect(surface).toHaveAttribute("aria-expanded", "true");
  });

  it("filters slash commands and inserts a persisted recall callout", async () => {
    const { onChange } = await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("/rec");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /Recall callout/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await userEvent.keyboard("{Enter}Remember the invariant");

    expect(screen.queryByRole("listbox", { name: "Block types" })).not.toBeInTheDocument();
    expect(document.querySelector(".note-callout")).toHaveTextContent("Remember the invariant");
    await waitFor(() => {
      const saved = onChange.mock.calls.at(-1)?.[0] as string;
      expect(JSON.parse(saved).content[0].type).toBe("callout");
    });
  });

  it("converts an existing block when a slash command is invoked at its start", async () => {
    const { editor } = await renderEditor(SAMPLE);
    editor.commands.setTextSelection(1);
    editor.view.focus();
    await userEvent.keyboard("/rec{Enter}");

    await waitFor(() => {
      const firstBlock = document.querySelector(".ProseMirror")?.firstElementChild;
      expect(firstBlock).toHaveClass("note-callout");
      expect(firstBlock).toHaveTextContent("Intuition");
    });
  });

  it("puts the caret inside the code block it just inserted", async () => {
    const { editor } = await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("/code{Enter}");

    // Wait for the node view to mount and take focus, not just for the selection to move —
    // typing before the content DOM exists silently drops the keystrokes.
    await waitFor(() => {
      expect(editor.state.selection.$from.parent.type.name).toBe("codeBlock");
      expect(document.querySelector(".code-block__code")).toBeInTheDocument();
    });

    // userEvent reads "[" and "{" as key-descriptor syntax, so keep typed code free of them.
    await userEvent.keyboard("res = 0");
    expect(codeBlockTexts(editor)).toEqual(["res = 0"]);
  });

  it("indents with tab and carries indentation onto the next line", async () => {
    const { editor } = await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("/code{Enter}");
    await waitFor(() => {
      expect(editor.isActive("codeBlock")).toBe(true);
      expect(document.querySelector(".code-block__code")).toBeInTheDocument();
    });

    await userEvent.keyboard("for i in range(100):{Enter}total += i{Enter}done");

    // A single block, not one per line: Enter adds a line rather than splitting the block.
    // The opener steps in, and the line after it holds that indent rather than resetting.
    expect(codeBlockTexts(editor)).toEqual(["for i in range(100):\n  total += i\n  done"]);
    expect(editor.isActive("codeBlock")).toBe(true);
  });

  it("turns off text correction inside the code block", async () => {
    const { editor } = await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("/code{Enter}");
    await waitFor(() => {
      expect(editor.isActive("codeBlock")).toBe(true);
    });

    // Autocapitalising line starts or smart-quoting a string silently corrupts code.
    const code = document.querySelector(".code-block__code");
    expect(code).toHaveAttribute("autocapitalize", "off");
    expect(code).toHaveAttribute("autocorrect", "off");
    expect(code).toHaveAttribute("spellcheck", "false");
    // The surrounding prose keeps spellchecking.
    expect(surface).toHaveAttribute("spellcheck", "true");
  });

  it("indents a selection instead of replacing it", async () => {
    const { editor } = await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("/code{Enter}");
    await waitFor(() => {
      expect(editor.isActive("codeBlock")).toBe(true);
      expect(document.querySelector(".code-block__code")).toBeInTheDocument();
    });
    await userEvent.keyboard("a = 1{Enter}b = 2");

    // Select both lines, the way you would before pressing Tab.
    const block = editor.state.selection.$from.start();
    editor.commands.setTextSelection({ from: block, to: block + "a = 1\nb = 2".length });
    await userEvent.keyboard("{Tab}");

    // Both lines shift; nothing is deleted.
    expect(codeBlockTexts(editor)).toEqual(["  a = 1\n  b = 2"]);

    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(codeBlockTexts(editor)).toEqual(["a = 1\nb = 2"]);
  });

  it("keeps tab inside the code block instead of moving focus to the language picker", async () => {
    const { editor } = await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("/code{Enter}");
    await waitFor(() => {
      expect(editor.isActive("codeBlock")).toBe(true);
    });

    await userEvent.keyboard("{Tab}x");

    expect(editor.state.selection.$from.parent.textContent).toBe("  x");
    expect(screen.getByRole("combobox", { name: "Code language" })).not.toHaveFocus();
  });

  it("leaves the slash menu closed inside a code block", async () => {
    const { editor } = await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("/code{Enter}");
    await waitFor(() => {
      expect(editor.isActive("codeBlock")).toBe(true);
    });

    await userEvent.keyboard("a / b");

    expect(screen.queryByRole("listbox", { name: "Block types" })).not.toBeInTheDocument();
  });

  it("selects the slash command the pointer is actually over", async () => {
    await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("/{ArrowDown}");

    // Keyboard moved the selection; hovering a different row must take it over, or the
    // mouse highlights one command while Enter inserts another.
    const codeBlock = screen.getByRole("option", { name: /Code block/ });
    await userEvent.hover(codeBlock);

    expect(codeBlock).toHaveAttribute("aria-selected", "true");
    expect(surface).toHaveAttribute("aria-activedescendant", "slash-command-code");
    expect(screen.getAllByRole("option").filter((o) => o.dataset.active === "true")).toHaveLength(
      1,
    );
  });

  it("moves through slash commands with arrows and closes with escape", async () => {
    await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("/{ArrowDown}");

    expect(screen.getByRole("option", { name: /Heading 1/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(surface).toHaveAttribute("aria-activedescendant", "slash-command-heading-1");

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Block types" })).not.toBeInTheDocument();
    expect(surface).toHaveFocus();
  });

  it("renders stored recall callouts", async () => {
    await renderEditor(CALLOUT);
    const callout = document.querySelector('.note-callout[data-type="callout"]');
    expect(callout).toHaveTextContent("Recall the shrinking-window invariant.");
  });

  it("inserts a discoverable code block and persists its selected language", async () => {
    const { editor, onChange } = await renderEditor(null);
    const surface = screen.getByRole("textbox", { name: "Problem notes" });
    await userEvent.click(surface);
    await userEvent.keyboard("/code{Enter}");

    const language = screen.getByRole("combobox", { name: "Code language" });
    expect(language).toHaveValue("");
    editor.view.focus();
    await userEvent.keyboard("const answer = 42");
    await userEvent.selectOptions(language, "javascript");

    await waitFor(() => {
      expect(document.querySelector(".code-block .hljs-keyword")).toHaveTextContent("const");
      const saved = onChange.mock.calls.at(-1)?.[0] as string;
      const documentJson = JSON.parse(saved) as {
        content: { type: string; attrs?: { language?: string } }[];
      };
      expect(documentJson.content[0]).toMatchObject({
        type: "codeBlock",
        attrs: { language: "javascript" },
      });
    });
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

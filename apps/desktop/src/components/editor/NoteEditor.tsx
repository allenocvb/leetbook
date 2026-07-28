import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { Callout } from "./Callout.js";
import { codeBlockNodeView } from "./codeBlockNodeView.js";
import {
  INDENT_UNIT,
  indentAfterNewline,
  lineStart,
  outdentWidth,
  shiftLines,
} from "./codeIndent.js";
import { codeLowlight } from "./codeLanguages.js";
import { SlashCommandMenu, type SlashMenuState } from "./SlashCommandMenu.js";
import { filterSlashCommands, type SlashCommand } from "./slashCommands.js";
import "./CodeBlock.css";
import "./NoteEditor.css";

/** Everything in the current code block before the caret. Code blocks hold plain text. */
function codeTextBefore(editor: Editor): string {
  const { $from } = editor.state.selection;
  return $from.parent.textBetween(0, $from.parentOffset);
}

/**
 * A code block should behave like a code editor: Tab indents instead of escaping to the
 * language picker, and Enter carries the current indentation forward, stepping in after
 * a line that opens a block.
 */
const EditorCodeBlock = CodeBlockLowlight.extend({
  /*
   * Above every other extension so these shortcuts are consulted first. At the default
   * priority ProseMirror's base keymap sees Enter ahead of us and happily splits the code
   * block in two, so the indentation handler below never runs.
   */
  priority: 1000,

  addNodeView() {
    return codeBlockNodeView;
  },

  addKeyboardShortcuts() {
    const inCodeBlock = () => this.editor.isActive("codeBlock");

    /*
     * Written as a text transaction rather than insertContent, which parses strings as
     * HTML — that collapses the leading spaces and newlines this whole feature is made of.
     */
    const insertText = (text: string) =>
      this.editor.commands.command(({ tr, state }) => {
        const { from, to } = state.selection;
        tr.insertText(text, from, to);
        return true;
      });

    /**
     * Tab/Shift-Tab over a selection shifts whole lines rather than replacing the selection,
     * which is what a code editor does — and what the old handler got wrong, silently
     * deleting whatever was highlighted.
     */
    const shiftSelection = (direction: "in" | "out") => {
      const { $from, from, to } = this.editor.state.selection;
      const blockStart = $from.start();
      const text = $from.parent.textContent;

      const shifted = shiftLines(text, from - blockStart, to - blockStart, direction);
      // Already flush left: swallow the key rather than moving focus to the language select.
      if (shifted.text === text.slice(shifted.from, shifted.to)) return true;

      const absFrom = blockStart + shifted.from;
      return (
        this.editor
          .chain()
          .command(({ tr }) => {
            tr.insertText(shifted.text, absFrom, blockStart + shifted.to);
            return true;
          })
          // Reselect the shifted lines so Tab can be pressed repeatedly.
          .setTextSelection({ from: absFrom, to: absFrom + shifted.text.length })
          .run()
      );
    };

    return {
      ...this.parent?.(),

      // Returning true stops the browser moving focus to the language select.
      Tab: () => {
        if (!inCodeBlock()) return false;
        if (!this.editor.state.selection.empty) return shiftSelection("in");
        return insertText(INDENT_UNIT);
      },

      "Shift-Tab": () => {
        if (!inCodeBlock()) return false;
        if (!this.editor.state.selection.empty) return shiftSelection("out");

        const { $from } = this.editor.state.selection;
        const textBefore = codeTextBefore(this.editor);
        const width = outdentWidth(textBefore);
        if (width === 0) return true;

        const from = lineStart($from.start(), textBefore);
        return this.editor.commands.deleteRange({ from, to: from + width });
      },

      // Delegate the line break to newlineInCode, then apply the indent to the new line.
      Enter: () => {
        if (!inCodeBlock()) return false;

        const indent = indentAfterNewline(codeTextBefore(this.editor));
        return this.editor
          .chain()
          .newlineInCode()
          .command(({ tr }) => {
            if (indent) tr.insertText(indent, tr.selection.from);
            return true;
          })
          .run();
      },
    };
  },
}).configure({ lowlight: codeLowlight });

export const NOTE_PLACEHOLDER = "Type “/” for commands…";

export interface NoteEditorProps {
  /** Serialized TipTap document, or null for an empty note. */
  initialContentJson: string | null;
  /** Fires with the serialized document on every change. Debouncing is the caller's job. */
  onChange: (contentJson: string) => void;
  /** Test/integration hook: receive the editor instance once it exists. */
  onReady?: (editor: Editor) => void;
}

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

function parseInitialContent(json: string | null): object {
  if (!json) return EMPTY_DOC;
  try {
    return JSON.parse(json) as object;
  } catch {
    // Not JSON (e.g. imported plain text) — wrap it instead of losing it.
    return {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: json }] }],
    };
  }
}

function findSlashMenu(editor: Editor, container: HTMLElement | null): SlashMenuState | null {
  const { selection } = editor.state;
  if (!selection.empty || !selection.$from.parent.isTextblock) return null;
  // A code block is a textblock too, but `/` there is division or a comment, not a command.
  if (editor.isActive("codeBlock")) return null;

  const textBefore = selection.$from.parent.textBetween(0, selection.$from.parentOffset);
  const match = textBefore.match(/(?:^|\s)\/([a-z0-9-]*)$/i);
  if (!match) return null;

  const query = match[1] ?? "";
  if (filterSlashCommands(query).length === 0) return null;

  let left = 0;
  let top = 30;
  if (container) {
    const containerRect = container.getBoundingClientRect();
    try {
      const caret = editor.view.coordsAtPos(selection.from);
      left = Math.max(0, Math.min(caret.left - containerRect.left, containerRect.width - 310));
      top = caret.bottom - containerRect.top + 8;
    } catch {
      // jsdom and an editor during teardown may not expose caret layout.
    }
  }

  return {
    from: selection.from - query.length - 1,
    to: selection.from,
    query,
    left,
    top,
  };
}

/**
 * Notion-style rich text editor: markdown shortcuts (#, ``` etc.), bold/italic/code,
 * lists, blockquotes, and syntax-highlighted code blocks. v1 scope on purpose —
 * no embeds, no tables, no databases.
 */
export function NoteEditor({ initialContentJson, onChange, onReady }: NoteEditorProps) {
  const container = useRef<HTMLDivElement>(null);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateSlashMenu = useCallback((instance: Editor) => {
    setSlashMenu(findSlashMenu(instance, container.current));
    setActiveIndex(0);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      EditorCodeBlock,
      Placeholder.configure({ placeholder: NOTE_PLACEHOLDER }),
      Callout,
    ],
    content: parseInitialContent(initialContentJson),
    editorProps: {
      attributes: {
        "aria-label": "Problem notes",
        "aria-multiline": "true",
        role: "textbox",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(JSON.stringify(instance.getJSON()));
      updateSlashMenu(instance);
    },
    onSelectionUpdate: ({ editor: instance }) => {
      updateSlashMenu(instance);
    },
    onBlur: () => {
      setSlashMenu(null);
    },
    onCreate: ({ editor: instance }) => {
      onReady?.(instance);
    },
  });

  const selectCommand = useCallback(
    (command: SlashCommand) => {
      if (!editor || !slashMenu) return;
      command.run(editor, { from: slashMenu.from, to: slashMenu.to });
      setSlashMenu(null);
    },
    [editor, slashMenu],
  );

  useEffect(() => {
    if (!editor) return;
    const surface = editor.view.dom;
    surface.setAttribute("aria-controls", "note-editor-slash-menu");
    surface.setAttribute("aria-expanded", String(slashMenu !== null));
    const active = slashMenu ? filterSlashCommands(slashMenu.query)[activeIndex] : null;
    if (active) {
      surface.setAttribute("aria-activedescendant", `slash-command-${active.id}`);
    } else {
      surface.removeAttribute("aria-activedescendant");
    }
  }, [activeIndex, editor, slashMenu]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!editor || !slashMenu) return;
    const items = filterSlashCommands(slashMenu.query);
    if (items.length === 0) return;

    // While the menu is open its keys belong to the menu, not the document.
    const claim = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    if (event.key === "ArrowDown") {
      claim();
      setActiveIndex((current) => (current + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      claim();
      setActiveIndex((current) => (current - 1 + items.length) % items.length);
    } else if (event.key === "Home") {
      claim();
      setActiveIndex(0);
    } else if (event.key === "End") {
      claim();
      setActiveIndex(items.length - 1);
    } else if (event.key === "Enter") {
      claim();
      const command = items[activeIndex] ?? items[0];
      if (command) selectCommand(command);
    } else if (event.key === "Escape") {
      claim();
      setSlashMenu(null);
    }
  };

  return (
    <div ref={container} className="note-editor" onKeyDownCapture={handleKeyDown}>
      <EditorContent editor={editor} />
      {slashMenu && (
        <SlashCommandMenu
          state={slashMenu}
          activeIndex={activeIndex}
          onSelect={selectCommand}
          onHover={setActiveIndex}
        />
      )}
    </div>
  );
}

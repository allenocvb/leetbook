import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { Callout } from "./Callout.js";
import { SlashCommandMenu, type SlashMenuState } from "./SlashCommandMenu.js";
import { filterSlashCommands, type SlashCommand } from "./slashCommands.js";
import "./NoteEditor.css";

const lowlight = createLowlight(common);
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
      CodeBlockLowlight.configure({ lowlight }),
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

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + items.length) % items.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(items.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = items[activeIndex] ?? items[0];
      if (command) selectCommand(command);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSlashMenu(null);
    }
  };

  return (
    <div ref={container} className="note-editor" onKeyDownCapture={handleKeyDown}>
      <EditorContent editor={editor} />
      {slashMenu && (
        <SlashCommandMenu state={slashMenu} activeIndex={activeIndex} onSelect={selectCommand} />
      )}
    </div>
  );
}

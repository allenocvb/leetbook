import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
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

/**
 * Notion-style rich text editor: markdown shortcuts (#, ``` etc.), bold/italic/code,
 * lists, blockquotes, and syntax-highlighted code blocks. v1 scope on purpose —
 * no embeds, no tables, no databases.
 */
export function NoteEditor({ initialContentJson, onChange, onReady }: NoteEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: NOTE_PLACEHOLDER }),
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
    },
    onCreate: ({ editor: instance }) => {
      onReady?.(instance);
    },
  });

  return <EditorContent editor={editor} className="note-editor" />;
}

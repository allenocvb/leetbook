import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import "./SelectionToolbar.css";

/**
 * Notion-style formatting bar that appears over a text selection.
 *
 * Every mark here already ships with StarterKit, so this is presentation only — the
 * shortcuts (Cmd-B and friends) worked before and still do. It exists because the marks
 * were undiscoverable: nothing in the UI said they were available.
 */
export function SelectionToolbar({ editor }: { editor: Editor }) {
  const link = () => {
    const current = (editor.getAttributes("link").href as string | undefined) ?? "";
    // A plain prompt rather than a popover: this is a note editor, not a CMS, and the
    // native dialog keeps focus handling out of our hands.
    const href = window.prompt("Link URL", current);
    if (href === null) return; // cancelled

    if (href.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      // Suppressed inside code blocks: bolding source would be meaningless, and the block
      // has its own Tab/Enter behaviour to stay out of the way of.
      shouldShow={({ editor: instance, from, to }) =>
        from !== to && !instance.isActive("codeBlock")
      }
    >
      <div className="selection-toolbar" role="toolbar" aria-label="Format selection">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <span style={{ fontWeight: 700 }}>B</span>
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span style={{ fontStyle: "italic" }}>I</span>
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span style={{ textDecoration: "underline" }}>U</span>
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <span style={{ textDecoration: "line-through" }}>S</span>
        </ToolbarButton>

        <span className="selection-toolbar__divider" aria-hidden="true" />

        <ToolbarButton
          label="Inline code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <span className="selection-toolbar__mono">{"</>"}</span>
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor.isActive("link")} onClick={link}>
          🔗
        </ToolbarButton>

        <span className="selection-toolbar__divider" aria-hidden="true" />

        <ToolbarButton
          label="Clear formatting"
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
        >
          <span className="selection-toolbar__mono">Tx</span>
        </ToolbarButton>
      </div>
    </BubbleMenu>
  );
}

function ToolbarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="selection-toolbar__button"
      aria-label={label}
      aria-pressed={active}
      // Mousedown would blur the editor and collapse the selection before the click lands.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

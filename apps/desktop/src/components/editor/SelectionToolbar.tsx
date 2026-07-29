import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useRef, useState } from "react";
import { HIGHLIGHT_COLORS, type NoteColor, TEXT_COLORS } from "./notePalette.js";
import "./SelectionToolbar.css";

/**
 * Notion-style formatting bar that appears over a text selection.
 *
 * The marks themselves mostly ship with StarterKit, so this is largely presentation — the
 * shortcuts (Cmd-B and friends) worked before and still do. It exists because the marks were
 * undiscoverable: nothing in the UI said they were available. Colour is the exception; it has
 * no shortcut and no other entry point.
 */
export function SelectionToolbar({ editor }: { editor: Editor }) {
  const [openMenu, setOpenMenu] = useState<"text" | "highlight" | null>(null);
  const toggleMenu = (menu: "text" | "highlight") =>
    setOpenMenu((current) => (current === menu ? null : menu));
  const closeMenu = () => setOpenMenu(null);

  /*
   * A new selection makes the open swatch grid meaningless, and the bubble menu jumps to the
   * new position underneath it. Applying a colour does not move the selection, so this does
   * not fight the pickers themselves.
   */
  useEffect(() => {
    const close = () => setOpenMenu(null);
    editor.on("selectionUpdate", close);
    editor.on("blur", close);
    return () => {
      editor.off("selectionUpdate", close);
      editor.off("blur", close);
    };
  }, [editor]);

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

        <ColorMenu
          label="Text colour"
          open={openMenu === "text"}
          onToggle={() => toggleMenu("text")}
          onClose={closeMenu}
          colors={TEXT_COLORS}
          activeValue={editor.getAttributes("textStyle").color as string | undefined}
          onPick={(value) => editor.chain().focus().setColor(value).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
          clearLabel="Default colour"
          swatchStyle={(value) => ({ color: value })}
        >
          <span className="selection-toolbar__swatch-label">A</span>
        </ColorMenu>

        <ColorMenu
          label="Highlight"
          open={openMenu === "highlight"}
          onToggle={() => toggleMenu("highlight")}
          onClose={closeMenu}
          colors={HIGHLIGHT_COLORS}
          activeValue={editor.getAttributes("textStyle").backgroundColor as string | undefined}
          onPick={(value) => editor.chain().focus().setBackgroundColor(value).run()}
          onClear={() => editor.chain().focus().unsetBackgroundColor().run()}
          clearLabel="No highlight"
          swatchStyle={(value) => ({ backgroundColor: value })}
        >
          <span className="selection-toolbar__swatch-label selection-toolbar__swatch-label--marked">
            A
          </span>
        </ColorMenu>

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

/** A toolbar button that drops a grid of swatches beneath it. */
function ColorMenu({
  label,
  open,
  onToggle,
  onClose,
  colors,
  activeValue,
  onPick,
  onClear,
  clearLabel,
  swatchStyle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  colors: readonly NoteColor[];
  activeValue?: string;
  onPick: (value: string) => void;
  onClear: () => void;
  clearLabel: string;
  swatchStyle: (value: string) => React.CSSProperties;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Escape closes the grid without disturbing the selection, so the user can pick a
  // different mark instead of losing the whole bubble menu.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    const node = containerRef.current;
    node?.addEventListener("keydown", onKeyDown);
    return () => node?.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  /*
   * The swatch grid carries no `role="group"`: that role wants a semantic <fieldset>, which
   * these buttons are not. Each swatch already names itself in full ("Text colour: Green"),
   * so grouping adds nothing a screen reader does not get from the buttons themselves.
   */
  return (
    <div className="selection-toolbar__menu" ref={containerRef}>
      <ToolbarButton label={label} active={open} expanded={open} onClick={onToggle}>
        {children}
      </ToolbarButton>
      {open && (
        <div className="selection-toolbar__swatches">
          {colors.map((color) => (
            <button
              key={color.value}
              type="button"
              className="selection-toolbar__swatch"
              aria-label={`${label}: ${color.name}`}
              aria-pressed={activeValue === color.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onPick(color.value);
                onClose();
              }}
            >
              <span
                className="selection-toolbar__swatch-chip"
                style={swatchStyle(color.value)}
                aria-hidden="true"
              >
                A
              </span>
            </button>
          ))}
          <button
            type="button"
            className="selection-toolbar__swatch selection-toolbar__swatch--clear"
            aria-label={clearLabel}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            <span className="selection-toolbar__swatch-chip" aria-hidden="true">
              A
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  active = false,
  expanded,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  expanded?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="selection-toolbar__button"
      aria-label={label}
      aria-pressed={active}
      aria-expanded={expanded}
      // Mousedown would blur the editor and collapse the selection before the click lands.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

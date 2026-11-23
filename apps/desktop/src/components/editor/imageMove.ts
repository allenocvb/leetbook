import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** How far the pointer travels before a press on an image becomes a move. */
const MOVE_THRESHOLD = 4;
/** Distance from the scroll area's edge where a move starts scrolling it. */
const EDGE = 48;

/**
 * Where a block dropped at `y` lands: the start of the first top-level block whose middle is
 * below the pointer, or the end of the note. `blocks` are the note's top-level blocks in order.
 */
export function insertionPoint(
  blocks: { pos: number; top: number; bottom: number }[],
  y: number,
  end: number,
): number {
  for (const block of blocks) {
    if (y < (block.top + block.bottom) / 2) return block.pos;
  }
  return end;
}

/** Moves the node at `from` to the gap at `to` (a position in the unchanged doc), selecting it. */
export function moveNode(tr: Transaction, from: number, to: number): Transaction | null {
  const node = tr.doc.nodeAt(from);
  if (!node || to === from || to === from + node.nodeSize) return null;
  tr.delete(from, from + node.nodeSize);
  const at = tr.mapping.map(to);
  tr.insert(at, node);
  return tr.setSelection(NodeSelection.create(tr.doc, at)).scrollIntoView();
}

function topLevelBlocks(view: EditorView) {
  const blocks: { pos: number; top: number; bottom: number }[] = [];
  view.state.doc.forEach((_node: PMNode, offset: number) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    const rect = dom.getBoundingClientRect();
    blocks.push({ pos: offset, top: rect.top, bottom: rect.bottom });
  });
  return blocks;
}

function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight)
      return node;
  }
  return null;
}

/**
 * Notion-style image moving: press an image and drag it between blocks while a line shows
 * where it will land. It runs on plain mouse events rather than HTML5 drag and drop, because
 * the macOS app's webview hands native drags to Tauri before the page ever sees them.
 */
export function imageMovePlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        dragstart: (_view, event) => {
          if (!(event.target instanceof HTMLImageElement)) return false;
          if (!event.target.classList.contains("note-image")) return false;
          event.preventDefault();
          return true;
        },
        mousedown: (view, event) => {
          const image = event.target;
          if (event.button !== 0 || !view.editable) return false;
          if (!(image instanceof HTMLImageElement) || !image.classList.contains("note-image"))
            return false;
          const from = view.posAtDOM(image, 0);
          if (view.state.doc.nodeAt(from)?.type.name !== "image") return false;
          event.preventDefault();
          view.focus();
          startPress(view, image, from, event);
          return true;
        },
      },
    },
  });
}

function startPress(view: EditorView, image: HTMLImageElement, from: number, down: MouseEvent) {
  let moving = false;
  let target: number | null = null;
  let lastY = down.clientY;
  let frame = 0;
  const line = document.createElement("div");
  line.className = "note-image-drop";
  line.setAttribute("aria-hidden", "true");
  const scroller = scrollParent(view.dom as HTMLElement);

  const place = (y: number) => {
    const blocks = topLevelBlocks(view);
    target = insertionPoint(blocks, y, view.state.doc.content.size);
    const editorRect = (view.dom as HTMLElement).getBoundingClientRect();
    const index = blocks.findIndex((block) => block.pos === target);
    const before = blocks[index - 1];
    const lineY =
      index === -1
        ? (blocks.at(-1)?.bottom ?? editorRect.top)
        : before
          ? (before.bottom + (blocks[index]?.top ?? before.bottom)) / 2
          : (blocks[index]?.top ?? editorRect.top);
    line.style.top = `${lineY - 1}px`;
    line.style.left = `${editorRect.left}px`;
    line.style.width = `${editorRect.width}px`;
  };

  const autoscroll = () => {
    frame = 0;
    if (!moving || !scroller) return;
    const rect = scroller.getBoundingClientRect();
    const step = lastY < rect.top + EDGE ? -12 : lastY > rect.bottom - EDGE ? 12 : 0;
    if (!step) return;
    scroller.scrollTop += step;
    place(lastY);
    frame = requestAnimationFrame(autoscroll);
  };

  const move = (event: MouseEvent) => {
    lastY = event.clientY;
    if (!moving) {
      const distance = Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY);
      if (distance < MOVE_THRESHOLD) return;
      moving = true;
      image.classList.add("note-image--moving");
      document.body.classList.add("note-image-moving");
      document.body.append(line);
    }
    event.preventDefault();
    place(event.clientY);
    if (!frame && scroller) frame = requestAnimationFrame(autoscroll);
  };

  const finish = (commit: boolean) => {
    document.removeEventListener("mousemove", move, true);
    document.removeEventListener("mouseup", up, true);
    document.removeEventListener("keydown", key, true);
    if (frame) cancelAnimationFrame(frame);
    line.remove();
    image.classList.remove("note-image--moving");
    document.body.classList.remove("note-image-moving");
    const { state } = view;
    const moved = commit && moving && target !== null ? moveNode(state.tr, from, target) : null;
    if (moved) view.dispatch(moved);
    else if (!moving && state.doc.nodeAt(from))
      view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, from)));
  };
  const up = () => finish(true);
  const key = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    finish(false);
  };

  document.addEventListener("mousemove", move, true);
  document.addEventListener("mouseup", up, true);
  document.addEventListener("keydown", key, true);
}

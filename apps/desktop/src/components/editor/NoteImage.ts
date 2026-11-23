import { Node } from "@tiptap/core";
import { imageMovePlugin } from "./imageMove.js";

/** Notes carry their own image bytes, so reopening or moving the source cannot break them. */
export const NoteImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  // Moved by imageMovePlugin, not HTML5 drag and drop (see imageMove.ts).
  draggable: false,
  addAttributes() {
    return { src: { default: null }, alt: { default: "Screenshot" } };
  },
  parseHTML() {
    return [{ tag: 'img[src^="data:image/"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const src =
      typeof HTMLAttributes.src === "string" &&
      /^data:image\/(png|jpeg|gif|webp);base64,/i.test(HTMLAttributes.src)
        ? HTMLAttributes.src
        : undefined;
    return ["img", { src, alt: HTMLAttributes.alt, class: "note-image", draggable: "false" }];
  },
  addProseMirrorPlugins() {
    return [imageMovePlugin()];
  },
});

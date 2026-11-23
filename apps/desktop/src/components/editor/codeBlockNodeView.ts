import type { NodeViewRendererProps } from "@tiptap/react";
import { createCodeLanguagePicker } from "./codeLanguagePicker.js";

/**
 * Plain DOM node view for the editable code block.
 *
 * Deliberately not a React node view. React's renderer nests its own managed element
 * inside the content element, and an empty code block rendered that way cannot receive a
 * DOM selection: inserting one left the caret in the paragraph after the block, so typing
 * went underneath it. Block types without a node view never had the problem. Here
 * `contentDOM` is the <code> element itself, which is what ProseMirror expects.
 */
export function codeBlockNodeView({ editor, node: initialNode, getPos }: NodeViewRendererProps) {
  let node = initialNode;
  const dom = document.createElement("div");
  dom.className = "code-block code-block--editable";

  const header = document.createElement("div");
  header.className = "code-block__header";
  header.contentEditable = "false";

  const setLanguage = (language: string | null) => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) return;
    editor.view.dispatch(editor.view.state.tr.setNodeAttribute(pos, "language", language));
  };
  const picker = createCodeLanguagePicker(node.attrs.language, setLanguage, () =>
    editor.view.focus(),
  );

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "code-block__copy";
  copy.textContent = "Copy";
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  copy.addEventListener("mousedown", (event) => event.preventDefault());
  copy.addEventListener("click", () => {
    void navigator.clipboard?.writeText(content.textContent ?? "").then(() => {
      copy.textContent = "Copied";
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        copy.textContent = "Copy";
      }, 1200);
    });
  });
  header.append(picker.element, copy);

  const body = document.createElement("pre");
  body.className = "code-block__body";
  const content = document.createElement("code");
  content.className = "code-block__code";
  /*
   * Code is not prose. Without these the platform text engine capitalises the first word
   * of every line, "fixes" identifiers, and swaps quotes and hyphens for typographic ones —
   * all of which silently corrupt a snippet.
   */
  content.setAttribute("autocapitalize", "off");
  content.setAttribute("autocorrect", "off");
  content.setAttribute("autocomplete", "off");
  content.setAttribute("spellcheck", "false");
  content.setAttribute("data-gramm", "false");
  // Safari's inline predictions draw marked text that swallows the next Enter.
  content.setAttribute("writingsuggestions", "false");
  body.append(content);

  dom.append(header, body);

  return {
    dom,
    contentDOM: content,
    update(updated: typeof node) {
      if (updated.type.name !== node.type.name) return false;
      node = updated;
      picker.setValue(updated.attrs.language);
      return true;
    },
    selectNode() {
      dom.dataset.selected = "true";
    },
    deselectNode() {
      delete dom.dataset.selected;
    },
    // The header's controls handle their own keys and clicks; keep ProseMirror out of them.
    stopEvent(event: Event) {
      return event.target instanceof Node && header.contains(event.target);
    },
    destroy() {
      picker.destroy();
      clearTimeout(copiedTimer);
    },
    // The header is outside the document; only content mutations concern ProseMirror.
    // Typed structurally: ProseMirror also passes synthetic `{ type: "selection" }` records.
    ignoreMutation(mutation: { target: Node }) {
      return !content.contains(mutation.target);
    },
  };
}

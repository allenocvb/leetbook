import type { NodeViewRendererProps } from "@tiptap/react";
import { CODE_LANGUAGES, normalizeCodeLanguage } from "./codeLanguages.js";

/**
 * Plain DOM node view for the editable code block.
 *
 * Deliberately not a React node view. React's renderer nests its own managed element
 * inside the content element, and an empty code block rendered that way cannot receive a
 * DOM selection: inserting one left the caret in the paragraph after the block, so typing
 * went underneath it. Block types without a node view never had the problem. Here
 * `contentDOM` is the <code> element itself, which is what ProseMirror expects.
 */
export function codeBlockNodeView({ editor, node, getPos }: NodeViewRendererProps) {
  const dom = document.createElement("div");
  dom.className = "code-block code-block--editable";

  const header = document.createElement("div");
  header.className = "code-block__header";
  header.contentEditable = "false";

  const language = document.createElement("select");
  language.className = "code-block__language";
  language.setAttribute("aria-label", "Code language");
  for (const option of CODE_LANGUAGES) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    language.append(element);
  }
  language.value = normalizeCodeLanguage(node.attrs.language) ?? "";
  language.addEventListener("change", () => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) return;
    editor.view.dispatch(
      editor.view.state.tr.setNodeAttribute(pos, "language", language.value || null),
    );
  });
  header.append(language);

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
  body.append(content);

  dom.append(header, body);

  return {
    dom,
    contentDOM: content,
    update(updated: typeof node) {
      if (updated.type.name !== node.type.name) return false;
      const next = normalizeCodeLanguage(updated.attrs.language) ?? "";
      if (language.value !== next) language.value = next;
      return true;
    },
    selectNode() {
      dom.dataset.selected = "true";
    },
    deselectNode() {
      delete dom.dataset.selected;
    },
    // The header is outside the document; only content mutations concern ProseMirror.
    // Typed structurally: ProseMirror also passes synthetic `{ type: "selection" }` records.
    ignoreMutation(mutation: { target: Node }) {
      return !content.contains(mutation.target);
    },
  };
}

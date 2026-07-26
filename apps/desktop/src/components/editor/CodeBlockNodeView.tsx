import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { CODE_LANGUAGES, normalizeCodeLanguage } from "./codeLanguages.js";

export function CodeBlockNodeView({ node, selected, updateAttributes }: NodeViewProps) {
  const language =
    normalizeCodeLanguage(typeof node.attrs.language === "string" ? node.attrs.language : null) ??
    "";

  return (
    <NodeViewWrapper
      className="code-block code-block--editable"
      data-selected={selected ? "true" : undefined}
    >
      <div className="code-block__header" contentEditable={false}>
        <select
          className="code-block__language"
          aria-label="Code language"
          value={language}
          onChange={(event) => updateAttributes({ language: event.target.value || null })}
        >
          {CODE_LANGUAGES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <pre className="code-block__body">
        {/* Runtime accepts semantic tags, but the current TipTap prop type is narrowed to "div". */}
        <NodeViewContent as={"code" as "div"} className="code-block__code" />
      </pre>
    </NodeViewWrapper>
  );
}

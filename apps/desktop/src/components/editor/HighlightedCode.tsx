import type { ReactNode } from "react";
import { codeLowlight, normalizeCodeLanguage } from "./codeLanguages.js";

interface HighlightNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HighlightNode[];
}

function renderNode(node: HighlightNode, key: string): ReactNode {
  if (node.type === "text") return node.value ?? "";
  const classValue = node.properties?.className;
  const className = Array.isArray(classValue) ? classValue.join(" ") : undefined;
  return (
    <span className={className} key={key}>
      {node.children?.map((child, index) => renderNode(child, `${key}-${index}`))}
    </span>
  );
}

export function HighlightedCode({ code, language }: { code: string; language: string | null }) {
  const normalized = normalizeCodeLanguage(language);
  const result = normalized
    ? codeLowlight.highlight(normalized, code)
    : codeLowlight.highlightAuto(code);
  const nodes = result.children as HighlightNode[];
  return <>{nodes.map((node, index) => renderNode(node, String(index)))}</>;
}

import type { Review } from "@leetbook/core";
import { formatShortDate } from "../lib/format.js";
import "./editor/CodeBlock.css";
import { codeLanguageLabel } from "./editor/codeLanguages.js";
import { HighlightedCode } from "./editor/HighlightedCode.js";

/** Read-only view of the most recent captured submission. */
export function CodeSnapshot({ review }: { review: Review }) {
  if (!review.codeSnapshot) return null;

  return (
    <section className="code-block code-block--readonly" aria-label="Latest solution snapshot">
      <div className="code-block__header">
        <span>{codeLanguageLabel(review.language)}</span>
        <span className="code-block__caption">snapshot · {formatShortDate(review.reviewedAt)}</span>
      </div>
      <pre className="code-block__body">
        <code className="code-block__code">
          <HighlightedCode code={review.codeSnapshot} language={review.language} />
        </code>
      </pre>
    </section>
  );
}

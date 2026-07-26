import type { Review } from "@leetbook/core";
import { formatShortDate } from "../lib/format.js";

/** Read-only view of the most recent captured submission (Phase 7 fills these in). */
export function CodeSnapshot({ review }: { review: Review }) {
  if (!review.codeSnapshot) return null;

  const meta = [
    review.language,
    `snapshot · ${formatShortDate(review.reviewedAt)}`,
    review.runtimeMs !== null ? `${review.runtimeMs} ms` : null,
    review.memoryMb !== null ? `${review.memoryMb} MB` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-label="Latest solution snapshot" style={{ margin: "16px 0" }}>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "6px 14px",
            fontSize: 11,
            color: "var(--text-secondary)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span>Solution</span>
          <span>{meta}</span>
        </div>
        <pre
          style={{
            margin: 0,
            padding: "12px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            overflowX: "auto",
          }}
        >
          <code>{review.codeSnapshot}</code>
        </pre>
      </div>
    </section>
  );
}

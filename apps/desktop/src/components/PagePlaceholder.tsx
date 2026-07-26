export interface PagePlaceholderProps {
  title: string;
  hint: string;
}

/** Quiet empty state used while a page is not yet built (see PRD phase for each). */
export function PagePlaceholder({ title, hint }: PagePlaceholderProps) {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px" }}>{title}</h1>
      <p style={{ color: "var(--text-secondary)", margin: 0 }}>{hint}</p>
    </div>
  );
}

import type { NotionImportIssue } from "@leetbook/core";

export interface ImportIssueListProps {
  label: string;
  issues: NotionImportIssue[];
}

export function ImportIssueList({ label, issues }: ImportIssueListProps) {
  if (issues.length === 0) return null;

  return (
    <details className="settings-import__issues" open={issues.length <= 3}>
      <summary>
        {label} ({issues.length})
      </summary>
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.line}-${issue.reason}`}>
            <strong>
              Line {issue.line} · {issue.title || "Untitled"}
            </strong>
            <span>{issue.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

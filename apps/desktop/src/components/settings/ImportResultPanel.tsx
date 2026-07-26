import type { NotionImportResult } from "@leetbook/core";
import { Button } from "../ui/Button.js";
import { ImportIssueList } from "./ImportIssueList.js";

export interface ImportResultPanelProps {
  result: NotionImportResult;
  onViewProblems: () => void;
}

export function ImportResultPanel({ result, onViewProblems }: ImportResultPanelProps) {
  const available = result.created + result.updated + result.unchanged;

  return (
    <section className="settings-import" aria-label="Import result" aria-live="polite">
      <div className="settings-import__header">
        <div>
          <strong>Import complete</strong>
          <span>{result.totalRows} rows read</span>
        </div>
        {available > 0 && (
          <Button variant="ghost" onClick={onViewProblems}>
            View imported problems
          </Button>
        )}
      </div>
      <dl className="settings-import__counts">
        <div>
          <dt>Added</dt>
          <dd>{result.created}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{result.updated}</dd>
        </div>
        <div>
          <dt>Unchanged</dt>
          <dd>{result.unchanged}</dd>
        </div>
        <div>
          <dt>Skipped</dt>
          <dd>{result.skipped.length}</dd>
        </div>
      </dl>
      <p className="settings-import__behavior">
        Existing problems match by LeetCode URL. Exact review snapshots are not duplicated, and
        newer local reviews stay untouched.
      </p>
      <ImportIssueList label="Warnings" issues={result.warnings} />
      <ImportIssueList label="Skipped rows" issues={result.skipped} />
    </section>
  );
}

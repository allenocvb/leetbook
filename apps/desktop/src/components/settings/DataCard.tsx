import type { NotionImportResult } from "@leetbook/core";
import { useRef } from "react";
import { Button } from "../ui/Button.js";

export interface DataStats {
  problems: number;
  reviews: number;
  notes: number;
}

export interface DataCardProps {
  stats: DataStats | null;
  importResult: NotionImportResult | null;
  message: string | null;
  onImport: (file: File) => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onViewProblems: () => void;
}

export function DataCard({
  stats,
  importResult,
  message,
  onImport,
  onExportJson,
  onExportMarkdown,
  onViewProblems,
}: DataCardProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <section className="settings-card" aria-labelledby="data-heading">
      <h2 id="data-heading">Data</h2>
      <p className="settings-data__stats">
        {stats
          ? `Local SQLite · ${stats.problems} problems · ${stats.reviews} reviews · ${stats.notes} notes`
          : "Reading local database…"}
      </p>
      <div className="settings-data__actions">
        <Button onClick={() => fileInput.current?.click()}>Import Notion CSV</Button>
        <input
          ref={fileInput}
          className="settings-data__file"
          type="file"
          accept=".csv,text/csv"
          aria-label="Notion CSV file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImport(file);
            event.target.value = "";
          }}
        />
        <Button variant="outline" onClick={onExportJson}>
          Export JSON
        </Button>
        <Button variant="outline" onClick={onExportMarkdown}>
          Export Markdown
        </Button>
      </div>

      {importResult && (
        <div className="settings-import" role="status">
          <div>
            <strong>{importResult.imported} imported</strong>
            {` · ${importResult.skipped.length} skipped`}
          </div>
          {importResult.skipped.length > 0 && (
            <ul>
              {importResult.skipped.map((skip) => (
                <li key={skip.line}>
                  line {skip.line} ({skip.title || "untitled"}): {skip.reason}
                </li>
              ))}
            </ul>
          )}
          {importResult.imported > 0 && (
            <Button variant="ghost" onClick={onViewProblems}>
              View imported problems
            </Button>
          )}
        </div>
      )}
      {message && (
        <p className="settings-card__message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

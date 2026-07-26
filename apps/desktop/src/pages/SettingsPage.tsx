import {
  exportDatabaseJson,
  exportNotesMarkdown,
  importNotionCsv,
  type NotionImportResult,
} from "@leetbook/core";
import { useEffect, useRef, useState } from "react";
import { PairingCard } from "../components/PairingCard.js";
import { useDb } from "../db/DbContext.js";
import { pickDirectory, saveTextFile, writeFileIn } from "../lib/fileio.js";

const card: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "16px 20px",
  marginBottom: 16,
  maxWidth: 640,
};

const primaryButton: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 6,
  background: "var(--text)",
  color: "var(--bg)",
  fontWeight: 500,
};

const secondaryButton: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 6,
  border: "1px solid var(--border)",
};

/** File.text() with a FileReader fallback (jsdom lacks File.text). */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function SettingsPage() {
  const db = useDb();
  const fileInput = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<{ problems: number; reviews: number } | null>(null);
  const [importResult, setImportResult] = useState<NotionImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshStats = async () => {
    const [p] = await db.select<{ n: number }>("SELECT COUNT(*) AS n FROM problems");
    const [r] = await db.select<{ n: number }>("SELECT COUNT(*) AS n FROM reviews");
    setStats({ problems: p?.n ?? 0, reviews: r?.n ?? 0 });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    void refreshStats();
  }, []);

  const handleImportFile = async (file: File) => {
    setMessage(null);
    try {
      const result = await importNotionCsv(db, await readFileText(file), new Date());
      setImportResult(result);
      await refreshStats();
    } catch (cause) {
      setMessage(`Import failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };

  const handleExportJson = async () => {
    const json = await exportDatabaseJson(db, new Date());
    const path = await saveTextFile("leetbook-export.json", json);
    setMessage(path ? `Exported to ${path}` : null);
  };

  const handleExportMarkdown = async () => {
    const notes = await exportNotesMarkdown(db);
    if (notes.length === 0) {
      setMessage("No notes to export yet.");
      return;
    }
    const dir = await pickDirectory();
    if (!dir) return;
    for (const note of notes) {
      await writeFileIn(dir, `${note.slug}.md`, note.markdown);
    }
    setMessage(`Exported ${notes.length} note${notes.length === 1 ? "" : "s"} to ${dir}`);
  };

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>Settings & Pairing</h1>
        <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 13 }}>
          {stats ? `Local SQLite · ${stats.problems} problems · ${stats.reviews} reviews` : "…"}
        </p>
      </header>

      <section style={card} aria-label="Data">
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Data</h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px" }}>
          Import your Notion table export, or back up everything as JSON. Notes export as one
          Markdown file per problem.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={primaryButton} onClick={() => fileInput.current?.click()}>
            Import Notion CSV
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            aria-label="Notion CSV file"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = "";
            }}
          />
          <button type="button" style={secondaryButton} onClick={() => void handleExportJson()}>
            Export JSON
          </button>
          <button type="button" style={secondaryButton} onClick={() => void handleExportMarkdown()}>
            Export Markdown
          </button>
        </div>

        {importResult && (
          <div
            role="status"
            style={{
              marginTop: 14,
              fontSize: 13,
              background: "var(--surface)",
              borderRadius: 6,
              padding: "10px 14px",
            }}
          >
            <strong>{importResult.imported} imported</strong>
            {` · ${importResult.skipped.length} skipped`}
            {importResult.skipped.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text-secondary)" }}>
                {importResult.skipped.map((skip) => (
                  <li key={skip.line}>
                    line {skip.line} ({skip.title || "untitled"}): {skip.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {message && (
          <p role="status" style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
            {message}
          </p>
        )}
      </section>

      <PairingCard />
    </div>
  );
}

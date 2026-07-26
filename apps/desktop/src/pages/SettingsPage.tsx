import {
  exportDatabaseJson,
  exportNotesMarkdown,
  importNotionCsv,
  type NotionImportResult,
  type SqlExecutor,
} from "@leetbook/core";
import { useCallback, useEffect, useState } from "react";
import type { CaptureRuntime } from "../capture/useCaptureListener.js";
import { ConnectionCard } from "../components/settings/ConnectionCard.js";
import { DataCard, type DataStats } from "../components/settings/DataCard.js";
import { SchedulingCard } from "../components/settings/SchedulingCard.js";
import { useDb } from "../db/DbContext.js";
import { pickDirectory, saveTextFile, writeFileIn } from "../lib/fileio.js";
import { readDailyNewLimit, writeDailyNewLimit } from "../settings/preferences.js";
import "./SettingsPage.css";

export interface SettingsPageProps {
  capture: CaptureRuntime;
  onViewProblems: () => void;
}

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

async function loadStats(db: SqlExecutor): Promise<DataStats> {
  const [[problems], [reviews], [notes]] = await Promise.all([
    db.select<{ n: number }>("SELECT COUNT(*) AS n FROM problems"),
    db.select<{ n: number }>("SELECT COUNT(*) AS n FROM reviews"),
    db.select<{ n: number }>("SELECT COUNT(*) AS n FROM notes"),
  ]);
  return {
    problems: problems?.n ?? 0,
    reviews: reviews?.n ?? 0,
    notes: notes?.n ?? 0,
  };
}

export function SettingsPage({ capture, onViewProblems }: SettingsPageProps) {
  const db = useDb();
  const [stats, setStats] = useState<DataStats | null>(null);
  const [dailyNewLimit, setDailyNewLimit] = useState(readDailyNewLimit);
  const [importResult, setImportResult] = useState<NotionImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const refreshStats = useCallback(async () => setStats(await loadStats(db)), [db]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const handleImport = async (file: File) => {
    setMessage(null);
    setImportResult(null);
    try {
      const result = await importNotionCsv(db, await readFileText(file), new Date());
      setImportResult(result);
      await refreshStats();
    } catch (cause) {
      setMessage(`Import failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };

  const handleExportJson = async () => {
    setMessage(null);
    const json = await exportDatabaseJson(db, new Date());
    const path = await saveTextFile("leetbook-export.json", json);
    if (path) setMessage(`Exported to ${path}`);
  };

  const handleExportMarkdown = async () => {
    setMessage(null);
    const notes = await exportNotesMarkdown(db);
    if (notes.length === 0) {
      setMessage("No notes to export yet.");
      return;
    }
    const directory = await pickDirectory();
    if (!directory) return;
    for (const note of notes) {
      await writeFileIn(directory, `${note.slug}.md`, note.markdown);
    }
    setMessage(`Exported ${notes.length} note${notes.length === 1 ? "" : "s"} to ${directory}`);
  };

  const changeDailyNewLimit = (value: number) => {
    setDailyNewLimit(writeDailyNewLimit(value));
  };

  return (
    <div className="settings-page">
      <div className="settings-page__content">
        <header className="settings-page__header">
          <h1>Settings &amp; Pairing</h1>
        </header>
        <div className="settings-page__cards">
          <ConnectionCard capture={capture} />
          <SchedulingCard
            dailyNewLimit={dailyNewLimit}
            onChangeDailyNewLimit={changeDailyNewLimit}
          />
          <DataCard
            stats={stats}
            importResult={importResult}
            message={message}
            onImport={(file) => void handleImport(file)}
            onExportJson={() => void handleExportJson()}
            onExportMarkdown={() => void handleExportMarkdown()}
            onViewProblems={onViewProblems}
          />
        </div>
      </div>
    </div>
  );
}

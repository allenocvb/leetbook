import {
  createNotesRepo,
  createProblemsRepo,
  createSchedulingRepo,
  type Note,
  type Problem,
  type SchedulingState,
} from "@leetbook/core";
import { useEffect, useRef, useState } from "react";
import { NoteEditor } from "../components/editor/NoteEditor.js";
import { DifficultyText } from "../components/table/pills.js";
import { useDb } from "../db/DbContext.js";
import { formatShortDate } from "../lib/format.js";

export interface ProblemNotesPageProps {
  problemId: string;
  onBack: () => void;
  /** Autosave debounce; tests pass 0. */
  saveDelayMs?: number;
}

type SaveState = "idle" | "pending" | "saved";

export function ProblemNotesPage({ problemId, onBack, saveDelayMs = 600 }: ProblemNotesPageProps) {
  const db = useDb();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [scheduling, setScheduling] = useState<SchedulingState | null>(null);
  const [note, setNote] = useState<Note | null | "loading">("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [p, s, n] = await Promise.all([
        createProblemsRepo(db).getById(problemId),
        createSchedulingRepo(db).get(problemId),
        createNotesRepo(db).get(problemId),
      ]);
      if (cancelled) return;
      setProblem(p);
      setScheduling(s);
      setNote(n);
    })();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [db, problemId]);

  const handleChange = (contentJson: string) => {
    setSaveState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void createNotesRepo(db)
        .put(problemId, contentJson, new Date())
        .then(() => setSaveState("saved"));
    }, saveDelayMs);
  };

  if (note === "loading") return null;
  if (!problem) return <p style={{ color: "var(--danger)" }}>Problem not found.</p>;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <button
        type="button"
        onClick={onBack}
        style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}
      >
        ← All Problems
      </button>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{problem.title}</h1>
        <a
          href={problem.url}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12, color: "var(--text-secondary)" }}
        >
          Open on LeetCode ↗
        </a>
      </div>

      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "110px 1fr",
          rowGap: 6,
          columnGap: 16,
          margin: "16px 0 0",
          fontSize: 13,
          color: "var(--text-secondary)",
        }}
      >
        <dt>Difficulty</dt>
        <dd style={{ margin: 0 }}>
          <DifficultyText difficulty={problem.difficulty} />
        </dd>
        <dt>Category</dt>
        <dd style={{ margin: 0 }}>{problem.tags.join(", ") || "—"}</dd>
        <dt>Next review</dt>
        <dd style={{ margin: 0 }}>{formatShortDate(scheduling?.dueAt ?? null)}</dd>
        <dt>Last review</dt>
        <dd style={{ margin: 0 }}>
          {scheduling
            ? `${formatShortDate(scheduling.lastReviewedAt)} · ${scheduling.reviewCount} reps`
            : "not reviewed yet"}
        </dd>
      </dl>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "20px 0" }} />

      <div style={{ position: "relative" }}>
        <span
          aria-live="polite"
          style={{
            position: "absolute",
            top: -34,
            right: 0,
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          {saveState === "pending" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
        </span>
        <NoteEditor initialContentJson={note?.contentJson ?? null} onChange={handleChange} />
      </div>
    </div>
  );
}

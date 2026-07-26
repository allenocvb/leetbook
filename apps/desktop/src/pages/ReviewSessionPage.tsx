import {
  applyReview,
  isPerformanceScore,
  listDueRows,
  mapScoreToRating,
  type PerformanceScore,
  previewReview,
  type TableRow,
} from "@leetbook/core";
import { useCallback, useEffect, useState } from "react";
import { SCORE_LABELS, ScorePicker } from "../components/review/ScorePicker.js";
import { DifficultyText } from "../components/table/pills.js";
import { useDb } from "../db/DbContext.js";

export interface ReviewSessionPageProps {
  onExit: () => void;
}

interface SessionResult {
  score: PerformanceScore;
}

export function ReviewSessionPage({ onExit }: ReviewSessionPageProps) {
  const db = useDb();
  const [queue, setQueue] = useState<TableRow[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<PerformanceScore | null>(null);
  const [previewDays, setPreviewDays] = useState<number | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);

  useEffect(() => {
    void listDueRows(db, new Date().toISOString()).then(setQueue);
  }, [db]);

  const current = queue?.[index] ?? null;
  const done = queue !== null && index >= queue.length;

  const select = useCallback(
    (score: PerformanceScore) => {
      if (!current) return;
      setSelected(score);
      void previewReview(db, current.problemId, score, new Date()).then((state) => {
        const days = Math.round((new Date(state.dueAt).getTime() - Date.now()) / 86_400_000);
        setPreviewDays(days);
      });
    },
    [db, current],
  );

  const confirm = useCallback(() => {
    if (!current || selected === null) return;
    void applyReview(db, { problemId: current.problemId, score: selected }, new Date()).then(() => {
      setResults((prev) => [...prev, { score: selected }]);
      setSelected(null);
      setPreviewDays(null);
      setIndex((i) => i + 1);
    });
  }, [db, current, selected]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onExit();
      const digit = Number(event.key);
      if (isPerformanceScore(digit)) return select(digit);
      if (event.key === "Enter") return confirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select, confirm, onExit]);

  if (queue === null) return null;

  if (queue.length === 0) {
    return (
      <Centered>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Nothing due</h1>
        <p style={{ color: "var(--text-secondary)" }}>Come back tomorrow — or add new problems.</p>
      </Centered>
    );
  }

  if (done) {
    return (
      <Centered>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Session complete</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          {results.length} reviewed · {results.filter((r) => r.score >= 3).length} recalled ·{" "}
          {results.filter((r) => r.score <= 1).length} to re-study
        </p>
        <button
          type="button"
          onClick={onExit}
          style={{
            marginTop: 12,
            padding: "8px 18px",
            borderRadius: 6,
            background: "var(--text)",
            color: "var(--bg)",
            fontWeight: 500,
          }}
        >
          Done
        </button>
      </Centered>
    );
  }

  if (!current) return null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          color: "var(--text-secondary)",
          marginBottom: 48,
        }}
      >
        <span>Review session</span>
        <span>
          {index + 1} of {queue.length}
        </span>
        <button type="button" onClick={onExit}>
          Exit
        </button>
      </div>

      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          Due today{current.tags[0] ? ` · ${current.tags[0]}` : ""}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 600, margin: "4px 0 8px" }}>{current.title}</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          <DifficultyText difficulty={current.difficulty} />
          {current.lastScore !== null && ` · last scored ${current.lastScore}`}
          {` · ${current.reviewCount} reps`}
        </p>
        <p style={{ margin: "16px 0 40px" }}>
          <a
            href={current.url}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 13,
              background: "var(--text)",
              color: "var(--bg)",
              padding: "7px 14px",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Open on LeetCode ↗
          </a>
        </p>

        <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>
          How well did you recall it?
        </p>
        <ScorePicker selected={selected} onSelect={select} />

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-secondary)",
            minHeight: 18,
            marginTop: 20,
          }}
        >
          {selected !== null && previewDays !== null
            ? `${SCORE_LABELS[selected]} → ${capitalize(mapScoreToRating(selected))} · due in ${previewDays} day${previewDays === 1 ? "" : "s"} · Enter to confirm`
            : ""}
        </p>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center" }}>
      <div>{children}</div>
    </div>
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

import { mapScoreToRating, type PerformanceScore, type TableRow } from "@leetbook/core";
import type { RefObject } from "react";
import { DifficultyText } from "../table/pills.js";
import { Button } from "../ui/Button.js";
import { ExternalLinkButton } from "../ui/ExternalLinkButton.js";
import { SCORE_LABELS, ScorePicker } from "./ScorePicker.js";
import "./ReviewSessionView.css";

export interface ReviewSessionViewProps {
  current: TableRow;
  index: number;
  total: number;
  selected: PerformanceScore | null;
  previewDueAt: string | null;
  submitting: boolean;
  error: string | null;
  pageRef: RefObject<HTMLDivElement | null>;
  onSelect: (score: PerformanceScore) => void;
  onShowNotes: () => void;
  onExit: () => void;
}

export function ReviewSessionView({
  current,
  index,
  total,
  selected,
  previewDueAt,
  submitting,
  error,
  pageRef,
  onSelect,
  onShowNotes,
  onExit,
}: ReviewSessionViewProps) {
  const progress = (index / total) * 100;

  return (
    <div className="review-session" ref={pageRef} tabIndex={-1}>
      <header className="review-session__topbar">
        <span className="review-session__label">Review session</span>
        <div
          className="review-session__progress"
          role="progressbar"
          aria-label="Review progress"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
        >
          <span className="review-session__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="review-session__count">
          {index + 1} of {total}
        </span>
        <Button variant="ghost" className="review-session__exit" onClick={onExit}>
          Exit
        </Button>
      </header>

      <main className="review-session__stage">
        <div className="review-session__content">
          <div className="review-session__eyebrow">
            Due today{current.tags[0] ? ` · ${current.tags[0]}` : ""}
          </div>
          <h1 className="review-session__title">{current.title}</h1>
          <div className="review-session__meta">
            <DifficultyText difficulty={current.difficulty} />
            <span aria-hidden="true">·</span>
            <span>last scored {current.lastScore ?? "–"}</span>
            <span aria-hidden="true">·</span>
            <span>{current.reviewCount} reps</span>
          </div>
          <div className="review-session__actions">
            <ExternalLinkButton className="ui-button ui-button--primary" url={current.url}>
              Open on LeetCode ↗
            </ExternalLinkButton>
            <Button variant="outline" onClick={onShowNotes}>
              Show my notes
            </Button>
          </div>

          <section className="review-session__rating" aria-labelledby="review-session-question">
            <h2 id="review-session-question">How well did you recall it?</h2>
            <ScorePicker
              key={current.problemId}
              selected={selected}
              onSelect={onSelect}
              disabled={submitting}
            />
            <p className="review-session__preview" aria-live="polite">
              {selected !== null && previewDueAt
                ? `${SCORE_LABELS[selected]} → ${capitalize(mapScoreToRating(selected))} · ${formatDue(previewDueAt)} · Enter to confirm`
                : "Choose 0–5. Your next review will be previewed before saving."}
            </p>
            {error && (
              <p className="review-session__error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function formatDue(dueAt: string): string {
  const days = Math.max(0, Math.round((new Date(dueAt).getTime() - Date.now()) / 86_400_000));
  return `due in ${days} day${days === 1 ? "" : "s"}`;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

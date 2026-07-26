import type { Problem, Review, SchedulingState } from "@leetbook/core";
import { DifficultyText } from "../table/pills.js";
import { Button } from "../ui/Button.js";
import { ExternalLinkButton } from "../ui/ExternalLinkButton.js";
import "./ProblemNotesHeader.css";

export interface ProblemNotesHeaderProps {
  problem: Problem;
  scheduling: SchedulingState | null;
  reviews: Review[];
  onBack: () => void;
  onEdit: () => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

export function formatNoteDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatDueDate(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return "—";
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((dueDay - nowDay) / DAY_MS);
  const relative =
    days === 0
      ? "today"
      : days === 1
        ? "tomorrow"
        : days > 1
          ? `in ${days} days`
          : `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
  return `${formatNoteDate(iso)} · ${relative}`;
}

function latestPerformance(reviews: Review[]): Review | null {
  for (let index = reviews.length - 1; index >= 0; index--) {
    const review = reviews[index];
    if (review && (review.runtimeMs !== null || review.memoryMb !== null)) return review;
  }
  return null;
}

export function ProblemNotesHeader({
  problem,
  scheduling,
  reviews,
  onBack,
  onEdit,
}: ProblemNotesHeaderProps) {
  const latestReview = reviews.at(-1) ?? null;
  const performance = latestPerformance(reviews);
  const reviewCount = scheduling?.reviewCount ?? reviews.length;
  const lastReviewedAt = latestReview?.reviewedAt ?? scheduling?.lastReviewedAt ?? null;
  const runtime = performance
    ? [
        performance.runtimeMs === null ? null : `${performance.runtimeMs} ms`,
        performance.memoryMb === null ? null : `${performance.memoryMb} MB`,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <header className="problem-notes-header">
      <button className="problem-notes-header__back" type="button" onClick={onBack}>
        ← All Problems
      </button>

      <div className="problem-notes-header__title-row">
        <h1>{problem.title}</h1>
        <div className="problem-notes-header__actions">
          <ExternalLinkButton className="ui-button ui-button--outline" url={problem.url}>
            Open on LeetCode ↗
          </ExternalLinkButton>
          <Button variant="ghost" onClick={onEdit}>
            Edit problem
          </Button>
        </div>
      </div>

      <dl className="problem-notes-header__metadata">
        <dt>Difficulty</dt>
        <dd>
          <DifficultyText difficulty={problem.difficulty} />
        </dd>
        <dt>Category</dt>
        <dd className="problem-notes-header__categories">
          {problem.tags.length > 0
            ? problem.tags.map((tag) => (
                <span className="problem-notes-header__chip" key={tag}>
                  {tag}
                </span>
              ))
            : "—"}
        </dd>
        <dt>Next review</dt>
        <dd className="problem-notes-header__next">{formatDueDate(scheduling?.dueAt ?? null)}</dd>
        <dt>Last review</dt>
        <dd className="problem-notes-header__mono">
          {lastReviewedAt
            ? `${formatNoteDate(lastReviewedAt)} · scored ${latestReview?.score ?? "–"} · ${reviewCount} reps`
            : "Not reviewed yet"}
        </dd>
        {runtime && (
          <>
            <dt>Runtime</dt>
            <dd className="problem-notes-header__mono">{runtime}</dd>
          </>
        )}
      </dl>
    </header>
  );
}

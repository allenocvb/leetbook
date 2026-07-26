import type { TableRow } from "@leetbook/core";
import { formatShortDate, isDue } from "../../lib/format.js";
import { DifficultyText, ScoreChip, StatusPill } from "./pills.js";

/**
 * A row is a grid, not a button. The name carries the only real control and stretches its
 * hit area over the whole row via `::after`, which keeps "click anywhere to open notes"
 * while leaving room for action buttons — a button cannot legally contain another button.
 */
export function ProblemTableRow({
  row,
  number,
  onOpen,
  onDelete,
}: {
  row: TableRow;
  number: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const nextReview = isDue(row.nextReview) ? "Today" : formatShortDate(row.nextReview);
  const category = row.tags.join(", ") || "—";

  return (
    <div className="problem-row">
      <span className="problem-row__name">
        <span className="problem-row__number">{number}</span>
        <button
          type="button"
          className="problem-row__open"
          aria-label={`Open notes for ${row.title}`}
          onClick={onOpen}
        >
          {row.title}
        </button>
        <span className="problem-row__arrow" aria-hidden="true">
          ↗
        </span>
      </span>
      <span>
        <StatusPill status={row.status} />
      </span>
      <span
        className={
          isDue(row.nextReview) ? "problem-row__date problem-row__date--due" : "problem-row__date"
        }
      >
        {nextReview}
      </span>
      <span className="problem-row__date problem-row__date--muted">
        {formatShortDate(row.lastReview)}
      </span>
      <span>
        <ScoreChip score={row.lastScore} />
      </span>
      <span className="problem-row__mono">{row.reviewCount}</span>
      <span className="problem-row__category" title={category}>
        {category}
      </span>
      <span>
        <DifficultyText difficulty={row.difficulty} />
      </span>
      <span className="problem-row__actions">
        <button
          type="button"
          className="problem-row__delete"
          aria-label={`Delete ${row.title}`}
          onClick={onDelete}
        >
          <span aria-hidden="true">×</span>
        </button>
      </span>
    </div>
  );
}

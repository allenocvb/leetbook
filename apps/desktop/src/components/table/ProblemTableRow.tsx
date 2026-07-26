import type { TableRow } from "@leetbook/core";
import { formatShortDate, isDue } from "../../lib/format.js";
import { DifficultyText, ScoreChip, StatusPill } from "./pills.js";

export function ProblemTableRow({
  row,
  number,
  onOpen,
}: {
  row: TableRow;
  number: number;
  onOpen: () => void;
}) {
  const nextReview = isDue(row.nextReview) ? "Today" : formatShortDate(row.nextReview);
  const category = row.tags.join(", ") || "—";

  return (
    <button
      type="button"
      className="problem-row"
      aria-label={`Open notes for ${row.title}`}
      onClick={onOpen}
    >
      <span className="problem-row__name">
        <span className="problem-row__number">{number}</span>
        <span className="problem-row__title">{row.title}</span>
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
    </button>
  );
}

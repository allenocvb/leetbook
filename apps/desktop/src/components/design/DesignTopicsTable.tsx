import type { DesignTableRow } from "@leetbook/core";
import { formatShortDate, isDue } from "../../lib/format.js";
import { ScoreChip, StatusPill } from "../table/pills.js";
import type { DesignSortKey, DesignSortState } from "./designRowLogic.js";
import "../table/ProblemTable.css";
import "./DesignTopicsTable.css";

const COLUMNS: { key: DesignSortKey; label: string }[] = [
  { key: "title", label: "Topic" },
  { key: "status", label: "Status" },
  { key: "nextReview", label: "Next Review" },
  { key: "lastReview", label: "Last Review" },
  { key: "lastScore", label: "Score" },
  { key: "reviewCount", label: "Reps" },
  { key: "tags", label: "Tags" },
];

export interface DesignTopicsTableProps {
  rows: DesignTableRow[];
  sort: DesignSortState;
  emptyMessage: string;
  onSort: (key: DesignSortKey) => void;
  onOpen: (topicId: string) => void;
  onDelete: (row: DesignTableRow) => void;
  onNew: () => void;
}

/**
 * Reuses the problem table's card, row, chip and pill styles wholesale — only the grid
 * template differs, because a design topic has no difficulty column. Two tables that look
 * subtly different for no reason is worse than one shared stylesheet with one override.
 */
export function DesignTopicsTable({
  rows,
  sort,
  emptyMessage,
  onSort,
  onOpen,
  onDelete,
  onNew,
}: DesignTopicsTableProps) {
  return (
    <div className="problem-table-scroll design-table">
      <div className="problem-table-grid">
        <div className="problem-table-header">
          {COLUMNS.map((column) => (
            <div key={column.key}>
              <button
                type="button"
                aria-label={`${column.label}, ${sortDescription(column.key, sort)}`}
                onClick={() => onSort(column.key)}
              >
                {column.label}
                <span aria-hidden="true">
                  {sort.key === column.key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                </span>
              </button>
            </div>
          ))}
        </div>

        <div className="problem-table-rows">
          {rows.map((row, index) => (
            <DesignTopicRow
              key={row.topicId}
              row={row}
              number={index + 1}
              onOpen={() => onOpen(row.topicId)}
              onDelete={() => onDelete(row)}
            />
          ))}
        </div>

        {rows.length === 0 && <div className="problem-table-empty">{emptyMessage}</div>}

        <button type="button" className="problem-table-new" onClick={onNew}>
          + New
        </button>
      </div>
    </div>
  );
}

function DesignTopicRow({
  row,
  number,
  onOpen,
  onDelete,
}: {
  row: DesignTableRow;
  number: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const nextReview = row.nextReview
    ? isDue(row.nextReview)
      ? "Today"
      : formatShortDate(row.nextReview)
    : "—";
  const tags = row.tags.join(", ");
  const shownTags = row.tags.slice(0, 2);
  const hiddenTagCount = row.tags.length - shownTags.length;

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
          row.nextReview && isDue(row.nextReview)
            ? "problem-row__date problem-row__date--due"
            : "problem-row__date"
        }
      >
        {nextReview}
      </span>
      <span className="problem-row__date problem-row__date--muted">
        {row.lastReview ? formatShortDate(row.lastReview) : "—"}
      </span>
      <span>
        <ScoreChip score={row.lastScore} />
      </span>
      <span className="problem-row__mono">{row.reviewCount}</span>
      {row.tags.length === 0 ? (
        <span className="problem-row__category--empty">—</span>
      ) : (
        <span className="problem-row__category" title={tags}>
          {shownTags.map((tag) => (
            <span key={tag} className="problem-row__tag">
              {tag}
            </span>
          ))}
          {hiddenTagCount > 0 && (
            <span className="problem-row__tag problem-row__tag--more">+{hiddenTagCount}</span>
          )}
        </span>
      )}
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

function sortDescription(key: DesignSortKey, sort: DesignSortState): string {
  if (key !== sort.key) return "not sorted";
  return `sorted ${sort.dir === "asc" ? "ascending" : "descending"}`;
}

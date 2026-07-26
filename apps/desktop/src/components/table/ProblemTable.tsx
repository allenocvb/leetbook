import type { TableRow } from "@leetbook/core";
import { formatShortDate, isDue } from "../../lib/format.js";
import { DifficultyText, ScoreChip, StatusPill } from "./pills.js";
import type { SortKey, SortState } from "./rowLogic.js";
import "./ProblemTable.css";

interface Column {
  key: SortKey | null;
  label: string;
}

const COLUMNS: Column[] = [
  { key: "title", label: "Name" },
  { key: "status", label: "Status" },
  { key: "nextReview", label: "Next Review" },
  { key: "lastReview", label: "Last Review" },
  { key: "lastScore", label: "Score" },
  { key: "reviewCount", label: "Reps" },
  { key: null, label: "Category" },
  { key: "difficulty", label: "Difficulty" },
];

export interface ProblemTableProps {
  rows: TableRow[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  /** Opens the problem's notes page. */
  onOpen: (problemId: string) => void;
}

/** Presentational table. Sorting/filtering is decided by the parent (see rowLogic). */
export function ProblemTable({ rows, sort, onSort, onOpen }: ProblemTableProps) {
  return (
    <table className="problem-table">
      <thead>
        <tr>
          {COLUMNS.map((column) => (
            <th key={column.label} aria-sort={ariaSort(column.key, sort)}>
              {column.key ? (
                <button type="button" onClick={() => onSort(column.key as SortKey)}>
                  {column.label}
                  {sort.key === column.key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              ) : (
                column.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.problemId}>
            <td className="cell-title">
              <button type="button" onClick={() => onOpen(row.problemId)} title="Open notes">
                {row.title}
              </button>{" "}
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${row.title} on LeetCode`}
                className="cell-external"
              >
                ↗
              </a>
            </td>
            <td>
              <StatusPill status={row.status} />
            </td>
            <td className={isDue(row.nextReview) ? "due-now" : "cell-muted"}>
              {isDue(row.nextReview) ? "Due" : formatShortDate(row.nextReview)}
            </td>
            <td className="cell-muted">{formatShortDate(row.lastReview)}</td>
            <td>
              <ScoreChip score={row.lastScore} />
            </td>
            <td className="cell-muted">{row.reviewCount}</td>
            <td className="cell-muted">{row.tags.join(", ") || "—"}</td>
            <td>
              <DifficultyText difficulty={row.difficulty} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ariaSort(key: SortKey | null, sort: SortState): "ascending" | "descending" | undefined {
  if (key === null || key !== sort.key) return undefined;
  return sort.dir === "asc" ? "ascending" : "descending";
}

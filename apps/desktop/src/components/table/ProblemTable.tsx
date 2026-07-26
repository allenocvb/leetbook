import type { TableRow } from "@leetbook/core";
import type { TableDensity } from "./ProblemsHeader.js";
import { ProblemTableRow } from "./ProblemTableRow.js";
import type { SortKey, SortState } from "./rowLogic.js";
import "./ProblemTable.css";

interface Column {
  key: SortKey;
  label: string;
}

const COLUMNS: Column[] = [
  { key: "title", label: "Name" },
  { key: "status", label: "Status" },
  { key: "nextReview", label: "Next Review" },
  { key: "lastReview", label: "Last Review" },
  { key: "lastScore", label: "Score" },
  { key: "reviewCount", label: "Reps" },
  { key: "category", label: "Category" },
  { key: "difficulty", label: "Difficulty" },
];

export interface ProblemTableProps {
  rows: TableRow[];
  sort: SortState;
  density: TableDensity;
  emptyMessage: string;
  onSort: (key: SortKey) => void;
  onOpen: (problemId: string) => void;
  onNew: () => void;
}

export function ProblemTable({
  rows,
  sort,
  density,
  emptyMessage,
  onSort,
  onOpen,
  onNew,
}: ProblemTableProps) {
  return (
    <div className="problem-table-scroll" data-density={density}>
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
            <ProblemTableRow
              key={row.problemId}
              row={row}
              number={index + 1}
              onOpen={() => onOpen(row.problemId)}
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

function sortDescription(key: SortKey, sort: SortState): string {
  if (key !== sort.key) return "not sorted";
  return `sorted ${sort.dir === "asc" ? "ascending" : "descending"}`;
}

import { useMemo, useState } from "react";
import { ProblemTable } from "../components/table/ProblemTable.js";
import {
  filterRows,
  type SortKey,
  type SortState,
  sortRows,
} from "../components/table/rowLogic.js";
import { useTableRows } from "../hooks/useTableRows.js";

export function DueTodayPage({
  onOpenProblem,
  category = null,
}: {
  onOpenProblem: (id: string) => void;
  category?: string | null;
}) {
  const { rows, loading, error } = useTableRows("due");
  const [sort, setSort] = useState<SortState>({ key: "nextReview", dir: "asc" });
  const visible = useMemo(
    () => sortRows(filterRows(rows, { query: "", category }), sort),
    [rows, category, sort],
  );

  const handleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  if (error) return <p style={{ color: "var(--danger)" }}>Failed to load due problems: {error}</p>;

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>Due Today</h1>
        <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 13 }}>
          {loading ? "Loading…" : `${visible.length} due`}
        </p>
      </header>

      {!loading && visible.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>
          {category
            ? "Nothing due in this category."
            : "Nothing due. Nice work — come back tomorrow."}
        </p>
      ) : (
        <ProblemTable rows={visible} sort={sort} onSort={handleSort} onOpen={onOpenProblem} />
      )}
    </div>
  );
}

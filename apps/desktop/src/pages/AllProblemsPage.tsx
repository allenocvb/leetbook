import { useMemo, useState } from "react";
import { AddProblemDialog } from "../components/AddProblemDialog.js";
import { ProblemTable } from "../components/table/ProblemTable.js";
import {
  collectCategories,
  filterRows,
  type SortKey,
  type SortState,
  sortRows,
} from "../components/table/rowLogic.js";
import { useTableRows } from "../hooks/useTableRows.js";

export function AllProblemsPage({ onOpenProblem }: { onOpenProblem: (id: string) => void }) {
  const { rows, loading, error, refresh } = useTableRows("all");
  const [sort, setSort] = useState<SortState>({ key: "title", dir: "asc" });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const categories = useMemo(() => collectCategories(rows), [rows]);
  const visible = useMemo(
    () => sortRows(filterRows(rows, { query, category }), sort),
    [rows, query, category, sort],
  );

  const handleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  if (error) return <p style={{ color: "var(--danger)" }}>Failed to load problems: {error}</p>;

  return (
    <div>
      <header
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>All Problems</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 13 }}>
            {loading ? "Loading…" : `${visible.length} of ${rows.length} problems`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          style={{
            padding: "7px 14px",
            borderRadius: 6,
            background: "var(--text)",
            color: "var(--bg)",
            fontWeight: 500,
          }}
        >
          + New problem
        </button>
      </header>

      <AddProblemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void refresh()}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Search problems"
          aria-label="Search problems"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            font: "inherit",
            padding: "6px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            width: 240,
          }}
        />
        <select
          aria-label="Filter by category"
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value === "" ? null : e.target.value)}
          style={{
            font: "inherit",
            padding: "6px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg)",
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {!loading && rows.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>
          No problems yet. Solve one on LeetCode or import your Notion table from Settings.
        </p>
      ) : (
        <ProblemTable rows={visible} sort={sort} onSort={handleSort} onOpen={onOpenProblem} />
      )}
    </div>
  );
}

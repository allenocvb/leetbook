import type { TableRow } from "@leetbook/core";
import { useMemo, useState } from "react";
import { AddProblemDialog } from "../components/AddProblemDialog.js";
import { DeleteProblemDialog } from "../components/table/DeleteProblemDialog.js";
import {
  ProblemsHeader,
  type ProblemsView,
  type TableDensity,
} from "../components/table/ProblemsHeader.js";
import { ProblemTable } from "../components/table/ProblemTable.js";
import {
  filterRows,
  type SortKey,
  type SortState,
  sortRows,
} from "../components/table/rowLogic.js";
import { useTableRows } from "../hooks/useTableRows.js";

export interface ProblemsPageProps {
  view: ProblemsView;
  onViewChange: (view: ProblemsView) => void;
  onOpenProblem: (id: string) => void;
  category: string | null;
  onCategoryChange: (category: string | null) => void;
  refreshKey?: unknown;
}

function emptyMessage(view: ProblemsView, filtered: boolean, category: string | null) {
  if (category && view === "due") return "Nothing here yet — nothing due in this category.";
  if (filtered) return "Nothing here yet — nothing matches these filters.";
  if (view === "due") return "Nothing due today — nice work.";
  return "Nothing here yet — add your first problem.";
}

export function ProblemsPage({
  view,
  onViewChange,
  onOpenProblem,
  category,
  onCategoryChange,
  refreshKey,
}: ProblemsPageProps) {
  const { rows, loading, error, refresh } = useTableRows(view, refreshKey);
  const [sort, setSort] = useState<SortState>({
    key: view === "all" ? "title" : "nextReview",
    dir: "asc",
  });
  const [query, setQuery] = useState("");
  const [density, setDensity] = useState<TableDensity>("comfortable");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<TableRow | null>(null);

  const visible = useMemo(
    () => sortRows(filterRows(rows, { query, category }), sort),
    [rows, query, category, sort],
  );

  const filtered = query.trim() !== "" || category !== null;
  const subtitle = loading
    ? "Loading…"
    : filtered
      ? `${visible.length} of ${rows.length} ${view === "due" ? "due" : "problems"}`
      : view === "due"
        ? `${rows.length} due today`
        : `${rows.length} problems`;

  const handleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  if (error) {
    return (
      <div className="problems-page">
        <p className="problems-page__error">
          Failed to load {view === "due" ? "due problems" : "problems"}: {error}
        </p>
      </div>
    );
  }

  return (
    <section className="problems-page" aria-label={view === "due" ? "Due Today" : "All Problems"}>
      <ProblemsHeader
        view={view}
        title={view === "due" ? "Due Today" : "All Problems"}
        subtitle={subtitle}
        query={query}
        onQueryChange={setQuery}
        category={category}
        onClearCategory={() => onCategoryChange(null)}
        density={density}
        onDensityChange={setDensity}
        onClearFilters={() => {
          setQuery("");
          onCategoryChange(null);
        }}
        onViewChange={onViewChange}
        onNew={() => setDialogOpen(true)}
      />

      <AddProblemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void refresh()}
      />

      <ProblemTable
        rows={visible}
        sort={sort}
        density={density}
        emptyMessage={emptyMessage(view, filtered, category)}
        onSort={handleSort}
        onOpen={onOpenProblem}
        onDelete={setDeleting}
        onNew={() => setDialogOpen(true)}
      />

      {deleting && (
        <DeleteProblemDialog
          problemId={deleting.problemId}
          problemTitle={deleting.title}
          onClose={() => setDeleting(null)}
          onDeleted={() => void refresh()}
        />
      )}
    </section>
  );
}

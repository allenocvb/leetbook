import type { DesignTableRow } from "@leetbook/core";
import { useMemo, useState } from "react";
import { DeleteTopicDialog } from "../components/design/DeleteTopicDialog.js";
import { DesignTopicDialog } from "../components/design/DesignTopicDialog.js";
import { DesignTopicsTable } from "../components/design/DesignTopicsTable.js";
import {
  type DesignSortKey,
  type DesignSortState,
  filterDesignRows,
  sortDesignRows,
} from "../components/design/designRowLogic.js";
import { Button } from "../components/ui/Button.js";
import { useDesignRows } from "../hooks/useDesignRows.js";
import "../components/table/ProblemsPage.css";

export interface DesignTopicsPageProps {
  onOpenTopic: (topicId: string) => void;
  refreshKey?: unknown;
}

export function DesignTopicsPage({ onOpenTopic, refreshKey }: DesignTopicsPageProps) {
  const { rows, loading, error, refresh } = useDesignRows(refreshKey);
  const [sort, setSort] = useState<DesignSortState>({ key: "title", dir: "asc" });
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<DesignTableRow | null>(null);

  const visible = useMemo(
    () => sortDesignRows(filterDesignRows(rows, query), sort),
    [rows, query, sort],
  );

  const filtered = query.trim() !== "";
  const subtitle = loading
    ? "Loading…"
    : filtered
      ? `${visible.length} of ${rows.length} topics`
      : `${rows.length} ${rows.length === 1 ? "topic" : "topics"}`;

  const handleSort = (key: DesignSortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  if (error) {
    return (
      <div className="problems-page">
        <p className="problems-page__error">Failed to load design topics: {error}</p>
      </div>
    );
  }

  return (
    <section className="problems-page" aria-label="System Design">
      <header className="problems-header">
        <div className="problems-header__top">
          <div className="problems-header__copy">
            <h1>System Design</h1>
            <div className="problems-header__subtitle">{subtitle}</div>
          </div>
          <div className="problems-header__actions">
            <div className="problems-header__search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                aria-label="Search topics"
                placeholder="Search topics"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Button onClick={() => setDialogOpen(true)}>+ New topic</Button>
          </div>
        </div>
      </header>

      <DesignTopicDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void refresh()}
      />

      <DesignTopicsTable
        rows={visible}
        sort={sort}
        emptyMessage={
          filtered
            ? "Nothing here yet — nothing matches that search."
            : "Nothing here yet — add your first design topic."
        }
        onSort={handleSort}
        onOpen={onOpenTopic}
        onDelete={setDeleting}
        onNew={() => setDialogOpen(true)}
      />

      {deleting && (
        <DeleteTopicDialog
          topicId={deleting.topicId}
          topicTitle={deleting.title}
          onClose={() => setDeleting(null)}
          onDeleted={() => void refresh()}
        />
      )}
    </section>
  );
}

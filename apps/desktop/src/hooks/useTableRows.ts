import { listDueRows, listTableRows, type TableRow } from "@leetbook/core";
import { useCallback, useEffect, useState } from "react";
import { useDb } from "../db/DbContext.js";

export interface TableRowsState {
  rows: TableRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Loads table rows for the All Problems ("all") or Due Today ("due") view. */
export function useTableRows(view: "all" | "due", refreshKey?: unknown): TableRowsState {
  const db = useDb();
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result =
        view === "all" ? await listTableRows(db) : await listDueRows(db, new Date().toISOString());
      setRows(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [db, view]);

  // `refreshKey` lets external database writes (such as extension capture) reload visible rows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an intentional external-write trigger
  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  return { rows, loading, error, refresh };
}

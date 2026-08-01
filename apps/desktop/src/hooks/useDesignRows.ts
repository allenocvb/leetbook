import { type DesignTableRow, listDesignTableRows } from "@leetbook/core";
import { useCallback, useEffect, useState } from "react";
import { useDb } from "../db/DbContext.js";

export interface DesignRowsState {
  rows: DesignTableRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDesignRows(refreshKey?: unknown): DesignRowsState {
  const db = useDb();
  const [rows, setRows] = useState<DesignTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listDesignTableRows(db));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [db]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an intentional external-write trigger
  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  return { rows, loading, error, refresh };
}

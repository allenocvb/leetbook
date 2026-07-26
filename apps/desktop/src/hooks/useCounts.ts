import { listDueRows, listTableRows } from "@leetbook/core";
import { useEffect, useState } from "react";
import { useDb } from "../db/DbContext.js";

export interface Counts {
  all: number;
  due: number;
}

/** Sidebar badge counts. `dep` retriggers the load (e.g. on view change). */
export function useCounts(dep: unknown): Counts {
  const db = useDb();
  const [counts, setCounts] = useState<Counts>({ all: 0, due: 0 });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [all, due] = await Promise.all([
        listTableRows(db),
        listDueRows(db, new Date().toISOString()),
      ]);
      if (!cancelled) setCounts({ all: all.length, due: due.length });
    })();
    return () => {
      cancelled = true;
    };
  }, [db, dep]);

  return counts;
}

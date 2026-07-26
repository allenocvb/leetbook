import { listDueRows, listTableRows } from "@leetbook/core";
import { useEffect, useState } from "react";
import type { CategoryCount } from "../components/Sidebar.js";
import { useDb } from "../db/DbContext.js";

export interface Counts {
  all: number;
  due: number;
  categories: CategoryCount[];
}

export function collectCategoryCounts(rows: { tags: string[] }[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const category of new Set(row.tags)) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Sidebar badge counts. `dep` retriggers the load (e.g. on view change). */
export function useCounts(dep: unknown): Counts {
  const db = useDb();
  const [counts, setCounts] = useState<Counts>({ all: 0, due: 0, categories: [] });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `dep` is an intentional refresh trigger (re-count on view change)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [allRows, dueRows] = await Promise.all([
        listTableRows(db),
        listDueRows(db, new Date().toISOString()),
      ]);
      if (!cancelled) {
        setCounts({
          all: allRows.length,
          due: dueRows.length,
          categories: collectCategoryCounts(allRows),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, dep]);

  return counts;
}

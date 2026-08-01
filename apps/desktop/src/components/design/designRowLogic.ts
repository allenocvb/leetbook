import type { DesignTableRow } from "@leetbook/core";

/**
 * Sorting for the design table.
 *
 * Separate from `rowLogic.ts` rather than generic over both: problems sort by difficulty and
 * search by slug, neither of which exists here. A shared function would need those branches to
 * be unreachable-but-present, which is how a "generic" helper quietly becomes two functions
 * wearing one name.
 */
export type DesignSortKey =
  | "title"
  | "status"
  | "nextReview"
  | "lastReview"
  | "lastScore"
  | "reviewCount"
  | "tags";

export interface DesignSortState {
  key: DesignSortKey;
  dir: "asc" | "desc";
}

const STATUS_ORDER = { new: 0, learning: 1, leech: 2, mastered: 3 } as const;

function compare(a: DesignTableRow, b: DesignTableRow, key: DesignSortKey): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title);
    case "status":
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case "tags":
      return (a.tags[0] ?? "").localeCompare(b.tags[0] ?? "");
    case "reviewCount":
      return a.reviewCount - b.reviewCount;
    case "lastScore":
      return (a.lastScore ?? -1) - (b.lastScore ?? -1);
    case "nextReview":
    case "lastReview": {
      const av = key === "nextReview" ? a.nextReview : a.lastReview;
      const bv = key === "nextReview" ? b.nextReview : b.lastReview;
      // Nulls always sort last, regardless of the direction flip afterwards.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av.localeCompare(bv);
    }
  }
}

export function sortDesignRows(rows: DesignTableRow[], sort: DesignSortState): DesignTableRow[] {
  return [...rows].sort((a, b) => {
    const result = compare(a, b, sort.key);
    return sort.dir === "asc" ? result : -result;
  });
}

/** Matches the title or the prompt — the prompt is where the useful words usually are. */
export function filterDesignRows(rows: DesignTableRow[], query: string): DesignTableRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return rows;
  return rows.filter(
    (row) =>
      row.title.toLowerCase().includes(needle) ||
      row.prompt.toLowerCase().includes(needle) ||
      row.tags.some((tag) => tag.toLowerCase().includes(needle)),
  );
}

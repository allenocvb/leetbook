import type { TableRow } from "@leetbook/core";

export type SortKey =
  | "title"
  | "status"
  | "nextReview"
  | "lastReview"
  | "lastScore"
  | "reviewCount"
  | "difficulty";

export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 } as const;
const STATUS_ORDER = { new: 0, learning: 1, leech: 2, mastered: 3 } as const;

function compare(a: TableRow, b: TableRow, key: SortKey): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title);
    case "difficulty":
      return DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
    case "status":
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case "reviewCount":
      return a.reviewCount - b.reviewCount;
    case "lastScore":
      return (a.lastScore ?? -1) - (b.lastScore ?? -1);
    case "nextReview":
    case "lastReview": {
      const av = key === "nextReview" ? a.nextReview : a.lastReview;
      const bv = key === "nextReview" ? b.nextReview : b.lastReview;
      // nulls always sort last, regardless of direction-flip afterwards
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av.localeCompare(bv);
    }
  }
}

export function sortRows(rows: TableRow[], sort: SortState): TableRow[] {
  const sorted = [...rows].sort((a, b) => {
    const result = compare(a, b, sort.key);
    return sort.dir === "asc" ? result : -result;
  });
  return sorted;
}

export interface RowFilter {
  query: string;
  category: string | null;
}

export function filterRows(rows: TableRow[], filter: RowFilter): TableRow[] {
  const query = filter.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.category !== null && !row.tags.includes(filter.category)) return false;
    if (query === "") return true;
    return row.title.toLowerCase().includes(query) || row.slug.includes(query);
  });
}

/** Unique categories across rows, alphabetical. */
export function collectCategories(rows: TableRow[]): string[] {
  return [...new Set(rows.flatMap((row) => row.tags))].sort();
}

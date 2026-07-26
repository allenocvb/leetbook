/**
 * The canonical LeetCode topic list.
 *
 * Categories are a closed set so they can be picked rather than typed. Free text produced
 * near-duplicates that fragment the sidebar — a Notion export spelled it "HashTable" while
 * LeetCode's own topic tags say "Hash Table", and both appeared as separate categories.
 * Spellings here match LeetCode's tags, which is what capture receives.
 */
export const CATEGORIES = [
  "Array",
  "String",
  "Hash Table",
  "Dynamic Programming",
  "Math",
  "Sorting",
  "Greedy",
  "Depth-First Search",
  "Binary Search",
  "Database",
  "Breadth-First Search",
  "Tree",
  "Matrix",
  "Two Pointers",
  "Binary Tree",
  "Bit Manipulation",
  "Heap (Priority Queue)",
  "Prefix Sum",
  "Stack",
  "Simulation",
  "Graph",
  "Counting",
  "Sliding Window",
  "Design",
  "Backtracking",
  "Enumeration",
  "Union Find",
  "Linked List",
  "Number Theory",
  "Monotonic Stack",
  "Trie",
  "Segment Tree",
  "Recursion",
  "Divide and Conquer",
  "Queue",
  "Binary Search Tree",
  "Memoization",
  "Geometry",
  "Topological Sort",
  "Hash Function",
  "Game Theory",
  "Shortest Path",
  "Combinatorics",
  "Interactive",
  "String Matching",
  "Rolling Hash",
  "Data Stream",
  "Brainteaser",
  "Randomized",
  "Monotonic Queue",
  "Merge Sort",
  "Iterator",
  "Concurrency",
  "Doubly-Linked List",
  "Probability and Statistics",
  "Quickselect",
  "Bucket Sort",
  "Suffix Array",
  "Minimum Spanning Tree",
  "Counting Sort",
  "Shell",
  "Line Sweep",
  "Reservoir Sampling",
  "Strongly Connected Component",
  "Eulerian Circuit",
  "Radix Sort",
  "Rejection Sampling",
  "Biconnected Component",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Lowercase, stripped of spaces, hyphens and punctuation, for tolerant matching. */
function fold(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const BY_FOLDED = new Map(CATEGORIES.map((name) => [fold(name), name]));

/**
 * Map any incoming spelling onto the canonical one. "HashTable", "hash table" and
 * "Hash-Table" all resolve to "Hash Table". Unknown topics are kept, trimmed, rather than
 * dropped — LeetCode adds tags over time and losing data is worse than an extra category.
 */
export function normalizeCategory(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return BY_FOLDED.get(fold(trimmed)) ?? trimmed;
}

/** Normalize a list, dropping blanks and duplicates while preserving order. */
export function normalizeCategories(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const name = normalizeCategory(value);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/** True when the name is part of the canonical set. */
export function isKnownCategory(value: string): boolean {
  return BY_FOLDED.has(fold(value));
}

/**
 * Rewrite stored categories through {@link normalizeCategory}. Run once after migrations:
 * problems saved before the canonical list existed carry variant spellings that would
 * otherwise keep showing up as separate sidebar entries. Idempotent, and returns how many
 * rows it actually changed.
 */
export async function normalizeStoredCategories(db: {
  select<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
}): Promise<number> {
  const rows = await db.select<{ id: string; tags: string }>("SELECT id, tags FROM problems");
  let changed = 0;

  for (const row of rows) {
    let stored: unknown;
    try {
      stored = JSON.parse(row.tags);
    } catch {
      continue; // Unparseable tags are left alone rather than destroyed.
    }
    if (!Array.isArray(stored)) continue;

    const next = normalizeCategories(stored.filter((t): t is string => typeof t === "string"));
    const encoded = JSON.stringify(next);
    if (encoded === row.tags) continue;

    await db.execute("UPDATE problems SET tags = ? WHERE id = ?", [encoded, row.id]);
    changed += 1;
  }
  return changed;
}

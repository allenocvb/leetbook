import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  isKnownCategory,
  normalizeCategories,
  normalizeCategory,
  normalizeStoredCategories,
} from "./categories.js";
import { migrate } from "./db/migrate.js";
import { createProblemsRepo } from "./db/repositories/problems.js";
import { createTestDb } from "./db/test-helpers.js";

describe("normalizeCategory", () => {
  it("resolves the spellings that fragmented the sidebar", () => {
    // The Notion export and LeetCode's own tags disagreed; both must land on one name.
    expect(normalizeCategory("HashTable")).toBe("Hash Table");
    expect(normalizeCategory("Hash Table")).toBe("Hash Table");
    expect(normalizeCategory("hash-table")).toBe("Hash Table");
    expect(normalizeCategory("  HASH TABLE  ")).toBe("Hash Table");
  });

  it("resolves other multi-word topics", () => {
    expect(normalizeCategory("binarysearch")).toBe("Binary Search");
    expect(normalizeCategory("Linked List")).toBe("Linked List");
    expect(normalizeCategory("dynamic programming")).toBe("Dynamic Programming");
  });

  it("keeps an unknown topic rather than dropping it", () => {
    expect(normalizeCategory("Quantum Annealing")).toBe("Quantum Annealing");
  });

  it("returns empty for blank input", () => {
    expect(normalizeCategory("   ")).toBe("");
  });
});

describe("normalizeCategories", () => {
  it("collapses variants of the same topic to one entry", () => {
    expect(normalizeCategories(["HashTable", "hash table", "Array"])).toEqual([
      "Hash Table",
      "Array",
    ]);
  });

  it("drops blanks and preserves order", () => {
    expect(normalizeCategories(["Array", "", "  ", "Tree"])).toEqual(["Array", "Tree"]);
  });
});

describe("CATEGORIES", () => {
  it("has no duplicates and every entry is self-normalizing", () => {
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
    for (const name of CATEGORIES) {
      expect(normalizeCategory(name)).toBe(name);
      expect(isKnownCategory(name)).toBe(true);
    }
  });

  it("does not treat an unknown topic as known", () => {
    expect(isKnownCategory("Quantum Annealing")).toBe(false);
  });
});

describe("normalizeStoredCategories", () => {
  it("merges variant spellings already in the database and is idempotent", async () => {
    const db = createTestDb();
    await migrate(db);
    const repo = createProblemsRepo(db);
    const now = new Date("2026-07-26T00:00:00.000Z");

    // Write variants straight to SQL, bypassing the repo's normalization, to stand in for
    // rows saved before the canonical list existed.
    await repo.upsertBySlug(
      { slug: "two-sum", title: "Two Sum", url: "u", difficulty: "easy", tags: [] },
      now,
    );
    const stored = await repo.getBySlug("two-sum");
    if (!stored) throw new Error("seed failed");
    await db.execute("UPDATE problems SET tags = ? WHERE id = ?", [
      JSON.stringify(["HashTable", "hash table", "Array"]),
      stored.id,
    ]);

    expect(await normalizeStoredCategories(db)).toBe(1);
    expect((await repo.getById(stored.id))?.tags).toEqual(["Hash Table", "Array"]);
    expect(await normalizeStoredCategories(db)).toBe(0);
  });
});

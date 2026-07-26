import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "../db/executor.js";
import { migrate } from "../db/migrate.js";
import { createProblemsRepo } from "../db/repositories/problems.js";
import { createTestDb } from "../db/test-helpers.js";
import { listTableRows } from "../views/table.js";
import { parseCsv } from "./csv.js";
import { importNotionCsv, parseNotionDate, slugFromUrl } from "./notion.js";

const FIXTURE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "notion-export.csv"),
  "utf8",
);
const NOW = new Date("2026-07-25T12:00:00.000Z");

describe("parseCsv", () => {
  it("handles quoted fields with commas and escaped quotes", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\n1,2,3')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("handles CRLF and a BOM", () => {
    expect(parseCsv("﻿x,y\r\n1,2\r\n")).toEqual([
      ["x", "y"],
      ["1", "2"],
    ]);
  });
});

describe("parseNotionDate", () => {
  it("parses long US dates as UTC midnight", () => {
    expect(parseNotionDate("October 15, 2025")?.toISOString()).toBe("2025-10-15T00:00:00.000Z");
  });

  it("rejects garbage", () => {
    expect(parseNotionDate("")).toBeNull();
    expect(parseNotionDate("15/10/2025")).toBeNull();
    expect(parseNotionDate("Smarch 1, 2025")).toBeNull();
  });
});

describe("slugFromUrl", () => {
  it("extracts slugs from problem, description, and submission URLs", () => {
    expect(slugFromUrl("https://leetcode.com/problems/two-sum/")).toBe("two-sum");
    expect(slugFromUrl("https://leetcode.com/problems/two-sum/description/")).toBe("two-sum");
    expect(slugFromUrl("https://leetcode.com/problems/valid-anagram/submissions/162070/")).toBe(
      "valid-anagram",
    );
    expect(slugFromUrl("https://example.com/nope")).toBeNull();
  });
});

describe("importNotionCsv with the real export", () => {
  let db: SqlExecutor;

  beforeEach(async () => {
    db = createTestDb();
    await migrate(db);
  });

  it("imports every row of the fixture", async () => {
    const result = await importNotionCsv(db, FIXTURE, NOW);
    expect(result.skipped).toEqual([]);
    expect(result.imported).toBe(47);
    expect(await createProblemsRepo(db).listAll()).toHaveLength(47);
  });

  it("preserves Notion's schedule and metadata in the table view", async () => {
    await importNotionCsv(db, FIXTURE, NOW);
    const rows = await listTableRows(db);

    const containsDuplicate = rows.find((r) => r.slug === "contains-duplicate");
    expect(containsDuplicate).toBeDefined();
    expect(containsDuplicate?.difficulty).toBe("easy");
    expect(containsDuplicate?.tags).toEqual(["Array"]);
    expect(containsDuplicate?.lastScore).toBe(5);
    expect(containsDuplicate?.reviewCount).toBe(5);
    expect(containsDuplicate?.nextReview).toBe("2025-10-15T00:00:00.000Z");
    expect(containsDuplicate?.lastReview).toBe("2025-09-07T00:00:00.000Z");
  });

  it("is idempotent — re-import does not duplicate problems", async () => {
    await importNotionCsv(db, FIXTURE, NOW);
    await importNotionCsv(db, FIXTURE, NOW);
    expect(await createProblemsRepo(db).listAll()).toHaveLength(47);
  });

  it("skips rows with unusable URLs and reports why", async () => {
    const csv =
      "Name,Status,Next Review,Last Review Date,Performance Score,Review Count,Category,Difficulty,URL\n" +
      'Broken,todo,"July 1, 2026","June 1, 2026",3,1,Array,Easy,https://example.com/nope\n' +
      'Fine,todo,"July 1, 2026","June 1, 2026",3,1,Array,Easy,https://leetcode.com/problems/two-sum/\n';
    const result = await importNotionCsv(db, csv, NOW);
    expect(result.imported).toBe(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain("URL");
  });

  it("imports problems without review history as new", async () => {
    const csv =
      "Name,Status,Next Review,Last Review Date,Performance Score,Review Count,Category,Difficulty,URL\n" +
      "Untouched,todo,,,,,Array,Easy,https://leetcode.com/problems/lru-cache/\n";
    const result = await importNotionCsv(db, csv, NOW);
    expect(result.imported).toBe(1);
    const rows = await listTableRows(db);
    expect(rows[0]?.status).toBe("new");
    expect(rows[0]?.nextReview).toBeNull();
  });
});

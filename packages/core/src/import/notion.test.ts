import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "../db/executor.js";
import { migrate } from "../db/migrate.js";
import { createProblemsRepo } from "../db/repositories/problems.js";
import { createReviewsRepo } from "../db/repositories/reviews.js";
import { createSchedulingRepo } from "../db/repositories/scheduling.js";
import { createTestDb } from "../db/test-helpers.js";
import { applyReview } from "../review.js";
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
    expect(parseNotionDate("February 31, 2025")).toBeNull();
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
    expect(result.warnings).toEqual([]);
    expect(result.created).toBe(47);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(result.totalRows).toBe(47);
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

  it("is idempotent — re-import reports unchanged rows and does not duplicate reviews", async () => {
    await importNotionCsv(db, FIXTURE, NOW);
    const second = await importNotionCsv(db, FIXTURE, NOW);
    expect(await createProblemsRepo(db).listAll()).toHaveLength(47);
    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 47 });

    const problem = await createProblemsRepo(db).getBySlug("contains-duplicate");
    expect(await createReviewsRepo(db).listByProblem(problem?.id ?? "")).toHaveLength(1);
  });

  it("skips rows with unusable URLs and reports why", async () => {
    const csv =
      "Name,Status,Next Review,Last Review Date,Performance Score,Review Count,Category,Difficulty,URL\n" +
      'Broken,todo,"July 1, 2026","June 1, 2026",3,1,Array,Easy,https://example.com/nope\n' +
      'Fine,todo,"July 1, 2026","June 1, 2026",3,1,Array,Easy,https://leetcode.com/problems/two-sum/\n';
    const result = await importNotionCsv(db, csv, NOW);
    expect(result.created).toBe(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain("URL");
  });

  it("imports problems without review history as new", async () => {
    const csv =
      "Name,Status,Next Review,Last Review Date,Performance Score,Review Count,Category,Difficulty,URL\n" +
      "Untouched,todo,,,,,Array,Easy,https://leetcode.com/problems/lru-cache/\n";
    const result = await importNotionCsv(db, csv, NOW);
    expect(result.created).toBe(1);
    const rows = await listTableRows(db);
    expect(rows[0]?.status).toBe("new");
    expect(rows[0]?.nextReview).toBeNull();
  });

  it("skips duplicate slugs within one CSV and identifies the first row", async () => {
    const header =
      "Name,Status,Next Review,Last Review Date,Performance Score,Review Count,Category,Difficulty,URL\n";
    const result = await importNotionCsv(
      db,
      `${header}Two Sum,todo,,,,,Array,Easy,https://leetcode.com/problems/two-sum/\n` +
        "Two Sum Again,todo,,,,,Array,Easy,https://leetcode.com/problems/two-sum/description/\n",
      NOW,
    );

    expect(result.created).toBe(1);
    expect(result.skipped).toEqual([
      {
        line: 3,
        title: "Two Sum Again",
        reason: "duplicate LeetCode problem in this CSV (first seen on line 2)",
      },
    ]);
  });

  it("reports existing metadata changes separately from unchanged duplicates", async () => {
    const header =
      "Name,Status,Next Review,Last Review Date,Performance Score,Review Count,Category,Difficulty,URL\n";
    const original = `${header}Two Sum,todo,,,,,Array,Easy,https://leetcode.com/problems/two-sum/\n`;
    await importNotionCsv(db, original, NOW);

    const updated = await importNotionCsv(
      db,
      `${header}Two Sum Updated,todo,,,,,HashTable,Medium,https://leetcode.com/problems/two-sum/\n`,
      NOW,
    );
    const unchanged = await importNotionCsv(
      db,
      `${header}Two Sum Updated,todo,,,,,HashTable,Medium,https://leetcode.com/problems/two-sum/\n`,
      NOW,
    );

    expect(updated).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
    expect(unchanged).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
  });

  it("preserves newer local reviews and scheduling when an older snapshot is re-imported", async () => {
    await importNotionCsv(db, FIXTURE, NOW);
    const problem = await createProblemsRepo(db).getBySlug("contains-duplicate");
    if (!problem) throw new Error("fixture problem missing");
    await applyReview(db, { problemId: problem.id, score: 4 }, NOW);
    const before = await createSchedulingRepo(db).get(problem.id);

    await importNotionCsv(db, FIXTURE, NOW);

    expect(await createSchedulingRepo(db).get(problem.id)).toEqual(before);
    expect(await createReviewsRepo(db).listByProblem(problem.id)).toHaveLength(2);
  });

  it("imports the problem but warns when partial review fields cannot be used", async () => {
    const csv =
      "Name,Status,Next Review,Last Review Date,Performance Score,Review Count,Category,Difficulty,URL\n" +
      'Two Sum,todo,"July 1, 2026","not a date",8,nope,Array,Easy,https://leetcode.com/problems/two-sum/\n';

    const result = await importNotionCsv(db, csv, NOW);

    expect(result.created).toBe(1);
    expect(result.warnings).toEqual([
      {
        line: 2,
        title: "Two Sum",
        reason: "review snapshot ignored; it needs a valid date and score from 0–5",
      },
    ]);
  });

  it("does not interpret a blank performance score as zero", async () => {
    const csv =
      "Name,Status,Next Review,Last Review Date,Performance Score,Review Count,Category,Difficulty,URL\n" +
      'Two Sum,todo,,"July 1, 2026",,,Array,Easy,https://leetcode.com/problems/two-sum/\n';

    const result = await importNotionCsv(db, csv, NOW);
    const problem = await createProblemsRepo(db).getBySlug("two-sum");

    expect(result.warnings[0]?.reason).toContain("review snapshot ignored");
    expect(await createReviewsRepo(db).listByProblem(problem?.id ?? "")).toEqual([]);
  });

  it("keeps local data when an imported timestamp conflicts with a different score", async () => {
    const header =
      "Name,Status,Next Review,Last Review Date,Performance Score,Review Count,Category,Difficulty,URL\n";
    const base =
      'Two Sum,todo,"July 10, 2026","July 1, 2026",3,1,Array,Easy,https://leetcode.com/problems/two-sum/\n';
    const conflict =
      'Two Sum,todo,"August 10, 2026","July 1, 2026",5,1,Array,Easy,https://leetcode.com/problems/two-sum/\n';
    await importNotionCsv(db, header + base, NOW);
    const problem = await createProblemsRepo(db).getBySlug("two-sum");
    if (!problem) throw new Error("imported problem missing");
    const schedule = await createSchedulingRepo(db).get(problem.id);

    const result = await importNotionCsv(db, header + conflict, NOW);

    expect(result).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(result.warnings[0]?.reason).toContain("different score");
    expect(await createReviewsRepo(db).listByProblem(problem.id)).toHaveLength(1);
    expect(await createSchedulingRepo(db).get(problem.id)).toEqual(schedule);
  });
});

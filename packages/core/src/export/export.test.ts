import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "../db/executor.js";
import { migrate } from "../db/migrate.js";
import { createNotesRepo } from "../db/repositories/notes.js";
import { createProblemsRepo } from "../db/repositories/problems.js";
import { createTestDb } from "../db/test-helpers.js";
import { importNotionCsv } from "../import/notion.js";
import { type DatabaseExport, exportDatabaseJson } from "./json.js";
import { exportNotesMarkdown, tiptapToMarkdown } from "./markdown.js";

const FIXTURE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "import",
    "__fixtures__",
    "notion-export.csv",
  ),
  "utf8",
);
const NOW = new Date("2026-07-25T12:00:00.000Z");

const SAMPLE_NOTE = JSON.stringify({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Intuition" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Store the " },
        { type: "text", text: "complement", marks: [{ type: "bold" }] },
        { type: "text", text: " in a hash map." },
      ],
    },
    {
      type: "codeBlock",
      attrs: { language: "python" },
      content: [{ type: "text", text: "seen = {}\nfor i, n in enumerate(nums): ..." }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "O(n) time" }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "O(n) space" }] }],
        },
      ],
    },
    {
      type: "callout",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Recall the complement before scanning." }],
        },
      ],
    },
  ],
});

let db: SqlExecutor;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
});

describe("tiptapToMarkdown", () => {
  it("renders headings, marks, code blocks, and lists", () => {
    const md = tiptapToMarkdown(SAMPLE_NOTE);
    expect(md).toContain("## Intuition");
    expect(md).toContain("Store the **complement** in a hash map.");
    expect(md).toContain("```python\nseen = {}");
    expect(md).toContain("- O(n) time\n- O(n) space");
    expect(md).toContain("> **Recall:** Recall the complement before scanning.");
  });

  it("returns non-JSON content unchanged instead of losing it", () => {
    expect(tiptapToMarkdown("plain text note")).toBe("plain text note");
  });
});

describe("exportDatabaseJson", () => {
  it("round-trips the imported fixture", async () => {
    await importNotionCsv(db, FIXTURE, NOW);
    const parsed = JSON.parse(await exportDatabaseJson(db, NOW)) as DatabaseExport;

    expect(parsed.format).toBe("leetbook");
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe(NOW.toISOString());
    expect(parsed.problems).toHaveLength(47);
    expect(parsed.reviews.length).toBeGreaterThan(0);
    expect(parsed.scheduling.length).toBeGreaterThan(0);

    const twoSum = parsed.problems.find((p) => p.slug === "two-sum");
    expect(twoSum?.title).toBe("Two Sum");
  });
});

describe("exportNotesMarkdown", () => {
  it("exports one document per problem with a note, with metadata header", async () => {
    await importNotionCsv(db, FIXTURE, NOW);
    const problems = createProblemsRepo(db);
    const notes = createNotesRepo(db);
    const twoSum = await problems.getBySlug("two-sum");
    expect(twoSum).not.toBeNull();
    if (!twoSum) return;
    await notes.put(twoSum.id, SAMPLE_NOTE, NOW);

    const exports = await exportNotesMarkdown(db);
    expect(exports).toHaveLength(1);
    expect(exports[0]?.slug).toBe("two-sum");
    expect(exports[0]?.markdown).toContain("# Two Sum");
    expect(exports[0]?.markdown).toContain("[LeetCode](https://leetcode.com/problems/two-sum/)");
    expect(exports[0]?.markdown).toContain("## Intuition");
  });
});

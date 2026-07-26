import { describe, expect, it } from "vitest";
import { migrate } from "./migrate.js";
import { MIGRATIONS } from "./migrations.js";
import { createTestDb } from "./test-helpers.js";

describe("migrate", () => {
  it("applies all migrations on a fresh database", async () => {
    const db = createTestDb();
    const { applied } = await migrate(db);
    expect(applied).toEqual(MIGRATIONS.map((m) => m.version));

    const tables = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = tables.map((t) => t.name);
    for (const expected of ["problems", "reviews", "scheduling", "notes", "schema_migrations"]) {
      expect(names).toContain(expected);
    }
  });

  it("is idempotent — second run applies nothing", async () => {
    const db = createTestDb();
    await migrate(db);
    const second = await migrate(db);
    expect(second.applied).toEqual([]);
  });

  it("records history with names and timestamps", async () => {
    const db = createTestDb();
    await migrate(db);
    const rows = await db.select<{ version: number; name: string; applied_at: string }>(
      "SELECT version, name, applied_at FROM schema_migrations ORDER BY version",
    );
    expect(rows[0]?.name).toBe("initial-schema");
    expect(rows[0]?.applied_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("rejects a database with unknown migration versions", async () => {
    const db = createTestDb();
    await migrate(db);
    await db.execute("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)", [
      99,
      "from-the-future",
      new Date().toISOString(),
    ]);
    await expect(migrate(db)).rejects.toThrow(/unknown to this build/);
  });

  it("rejects non-sequential migration lists", async () => {
    const db = createTestDb();
    const bad = [{ version: 2, name: "bad", statements: [] }];
    await expect(migrate(db, bad)).rejects.toThrow(/sequential/);
  });

  it("enforces schema constraints: difficulty check and FK cascade", async () => {
    const db = createTestDb();
    await migrate(db);

    await expect(
      db.execute(
        "INSERT INTO problems (id, slug, title, url, difficulty, tags, created_at) VALUES ('p1', 'two-sum', 'Two Sum', 'https://leetcode.com/problems/two-sum/', 'extreme', '[]', '2026-01-01T00:00:00Z')",
      ),
    ).rejects.toThrow();

    await db.execute(
      "INSERT INTO problems (id, slug, title, url, difficulty, tags, created_at) VALUES ('p1', 'two-sum', 'Two Sum', 'https://leetcode.com/problems/two-sum/', 'easy', '[]', '2026-01-01T00:00:00Z')",
    );
    await db.execute(
      "INSERT INTO reviews (id, problem_id, score, reviewed_at) VALUES ('r1', 'p1', 4, '2026-01-02T00:00:00Z')",
    );
    await db.execute("DELETE FROM problems WHERE id = 'p1'");
    const reviews = await db.select("SELECT * FROM reviews");
    expect(reviews).toEqual([]);
  });
});

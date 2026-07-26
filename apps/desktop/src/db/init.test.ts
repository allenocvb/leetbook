import { MIGRATIONS } from "@leetbook/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Tauri plugin: an in-memory stand-in that records statements.
const executed: { sql: string; params: unknown[] }[] = [];
const selected: string[] = [];

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: vi.fn(async () => ({
      execute: async (sql: string, params: unknown[] = []) => {
        executed.push({ sql, params });
      },
      select: async (sql: string) => {
        selected.push(sql);
        return []; // fresh database: no applied migrations
      },
    })),
  },
}));

import Database from "@tauri-apps/plugin-sql";
import { DB_PATH, initDatabase } from "./init.js";

beforeEach(() => {
  executed.length = 0;
  selected.length = 0;
  vi.clearAllMocks();
});

describe("initDatabase", () => {
  it("loads the app database file", async () => {
    await initDatabase();
    expect(Database.load).toHaveBeenCalledWith(DB_PATH);
  });

  it("applies every core migration on a fresh database", async () => {
    await initDatabase();
    // every migration statement ran…
    for (const migration of MIGRATIONS) {
      for (const statement of migration.statements) {
        expect(executed.some((e) => e.sql === statement)).toBe(true);
      }
    }
    // …and was recorded in schema_migrations
    const recorded = executed.filter((e) => e.sql.includes("INSERT INTO schema_migrations"));
    expect(recorded).toHaveLength(MIGRATIONS.length);
  });

  it("returns a working SqlExecutor", async () => {
    const db = await initDatabase();
    await db.execute("INSERT INTO notes VALUES (?, ?, ?)", ["p1", "{}", "now"]);
    expect(executed.at(-1)).toEqual({
      sql: "INSERT INTO notes VALUES (?, ?, ?)",
      params: ["p1", "{}", "now"],
    });
    expect(await db.select("SELECT 1")).toEqual([]);
  });
});

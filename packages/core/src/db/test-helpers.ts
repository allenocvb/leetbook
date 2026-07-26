import { DatabaseSync } from "node:sqlite";
import type { SqlExecutor } from "./executor.js";

/**
 * Test-only SqlExecutor backed by Node's built-in in-memory SQLite (node:sqlite,
 * Node >= 22). Production uses tauri-plugin-sql; this exists so core's SQL is
 * exercised against a real SQLite engine in unit tests with zero native deps.
 */
export function createTestDb(): SqlExecutor & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  return {
    raw,
    async execute(sql, params = []) {
      raw.prepare(sql).run(...(params as never[]));
    },
    async select<T>(sql: string, params: readonly unknown[] = []) {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
  };
}

import { migrate, normalizeStoredCategories, type SqlExecutor } from "@leetbook/core";
import Database from "@tauri-apps/plugin-sql";
import { createTauriSqlExecutor } from "./tauri-executor.js";

export const DB_PATH = "sqlite:leetbook.db";

/**
 * Opens (creating if needed) the app database and applies pending migrations.
 * Called once on app boot, before any UI renders data.
 */
export async function initDatabase(): Promise<SqlExecutor> {
  const database = await Database.load(DB_PATH);
  const executor = createTauriSqlExecutor(database);
  await migrate(executor);
  // Fold pre-canonical category spellings together (e.g. "HashTable" → "Hash Table").
  // Idempotent and cheap, so it runs every boot rather than needing a schema migration.
  await normalizeStoredCategories(executor);
  return executor;
}

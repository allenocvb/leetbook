import type { SqlExecutor } from "@leetbook/core";
import type Database from "@tauri-apps/plugin-sql";

/**
 * Adapts tauri-plugin-sql's Database to core's SqlExecutor interface.
 * All SQL lives in @leetbook/core; this file only bridges the transport.
 */
export function createTauriSqlExecutor(db: Database): SqlExecutor {
  return {
    async execute(sql, params = []) {
      await db.execute(sql, params as unknown[]);
    },
    async select<T = Record<string, unknown>>(sql: string, params: readonly unknown[] = []) {
      return await db.select<T[]>(sql, params as unknown[]);
    },
  };
}

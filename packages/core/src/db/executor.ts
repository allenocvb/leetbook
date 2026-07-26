/**
 * Minimal SQL interface that packages/core depends on. Platforms inject an
 * implementation: tauri-plugin-sql in the desktop app, better-sqlite3 in tests.
 * Core never imports a database driver directly.
 */
export interface SqlExecutor {
  /** Run a statement that returns no rows (DDL, INSERT, UPDATE, DELETE). */
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
  /** Run a query and return all rows as plain objects. */
  select<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

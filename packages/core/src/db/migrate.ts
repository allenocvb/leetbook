import type { SqlExecutor } from "./executor.js";
import { MIGRATIONS, type Migration } from "./migrations.js";

interface AppliedRow {
  version: number;
}

/**
 * Applies all pending migrations in version order. Idempotent: safe to call on
 * every app boot. Throws if the recorded history doesn't match the migration list
 * (e.g. a shipped migration was edited or removed).
 */
export async function migrate(
  db: SqlExecutor,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<{ applied: number[] }> {
  validate(migrations);

  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );

  const rows = await db.select<AppliedRow>(
    "SELECT version FROM schema_migrations ORDER BY version",
  );
  const appliedVersions = new Set(rows.map((r) => r.version));

  for (const version of appliedVersions) {
    if (!migrations.some((m) => m.version === version)) {
      throw new Error(
        `Database has migration v${version} that is unknown to this build — refusing to continue.`,
      );
    }
  }

  const applied: number[] = [];
  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;
    for (const statement of migration.statements) {
      await db.execute(statement);
    }
    await db.execute("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)", [
      migration.version,
      migration.name,
      new Date().toISOString(),
    ]);
    applied.push(migration.version);
  }
  return { applied };
}

function validate(migrations: readonly Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(
        `Migrations must be sequential starting at 1; found v${m.version} at position ${i}.`,
      );
    }
  });
}

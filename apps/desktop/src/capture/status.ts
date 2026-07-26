import type { SqlExecutor } from "@leetbook/core";

export interface LastCapture {
  slug: string;
  title: string;
  reviewedAt: string;
}

interface LastCaptureRow {
  slug: string;
  title: string;
  reviewed_at: string;
}

/** Finds the latest review carrying submission data, which identifies an extension capture. */
export async function loadLastCapture(db: SqlExecutor): Promise<LastCapture | null> {
  const [row] = await db.select<LastCaptureRow>(
    `SELECT p.slug, p.title, r.reviewed_at
       FROM reviews r
       JOIN problems p ON p.id = r.problem_id
      WHERE r.runtime_ms IS NOT NULL
         OR r.memory_mb IS NOT NULL
         OR r.language IS NOT NULL
         OR r.code_snapshot IS NOT NULL
      ORDER BY r.reviewed_at DESC
      LIMIT 1`,
  );
  return row ? { slug: row.slug, title: row.title, reviewedAt: row.reviewed_at } : null;
}

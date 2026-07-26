const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-07-28T…" → "Jul 28" (with year when not the current year). */
export function formatShortDate(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const base = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return date.getUTCFullYear() === now.getUTCFullYear()
    ? base
    : `${base}, ${date.getUTCFullYear()}`;
}

/** True when the date is at or before `now` — i.e. the review is due. */
export function isDue(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && time <= now.getTime();
}

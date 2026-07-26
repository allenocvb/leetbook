export const DAILY_NEW_LIMIT_KEY = "leetbook.daily-new-limit";
export const DEFAULT_DAILY_NEW_LIMIT = 5;
export const MAX_DAILY_NEW_LIMIT = 50;

interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function clampDailyNewLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DAILY_NEW_LIMIT;
  return Math.min(MAX_DAILY_NEW_LIMIT, Math.max(0, Math.round(value)));
}

export function readDailyNewLimit(storage: PreferenceStorage = window.localStorage): number {
  try {
    const stored = storage.getItem(DAILY_NEW_LIMIT_KEY);
    return stored === null ? DEFAULT_DAILY_NEW_LIMIT : clampDailyNewLimit(Number(stored));
  } catch {
    return DEFAULT_DAILY_NEW_LIMIT;
  }
}

export function writeDailyNewLimit(
  value: number,
  storage: PreferenceStorage = window.localStorage,
): number {
  const normalized = clampDailyNewLimit(value);
  try {
    storage.setItem(DAILY_NEW_LIMIT_KEY, String(normalized));
  } catch {
    // The in-memory preference still works when storage is unavailable.
  }
  return normalized;
}

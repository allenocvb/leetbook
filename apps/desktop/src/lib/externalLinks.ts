const LEETCODE_HOSTS = new Set(["leetcode.com", "www.leetcode.com"]);

export interface ExternalLinkAdapters {
  isTauri: () => boolean;
  openInTauri: (url: string) => Promise<void>;
  openInBrowser: (url: string) => void;
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function validateLeetCodeUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid LeetCode URL.");
  }

  const isProblemUrl =
    url.protocol === "https:" &&
    LEETCODE_HOSTS.has(url.hostname.toLowerCase()) &&
    url.port === "" &&
    /^\/problems\/[a-z0-9-]+(?:\/.*)?$/i.test(url.pathname);

  if (!isProblemUrl) throw new Error("Invalid LeetCode problem URL.");
  return url.toString();
}

async function openInTauri(url: string): Promise<void> {
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}

function openInBrowser(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

const defaultAdapters: ExternalLinkAdapters = {
  isTauri: isTauriRuntime,
  openInTauri,
  openInBrowser,
};

/** Opens a validated LeetCode problem in the system browser or a browser-safe test fallback. */
export async function openLeetCodeUrl(
  value: string,
  adapters: ExternalLinkAdapters = defaultAdapters,
): Promise<void> {
  const url = validateLeetCodeUrl(value);
  if (adapters.isTauri()) {
    await adapters.openInTauri(url);
    return;
  }
  adapters.openInBrowser(url);
}

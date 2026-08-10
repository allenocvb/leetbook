import { isTauriRuntime } from "../lib/externalLinks.js";

/**
 * Reads and writes the AI provider key.
 *
 * Backed by the OS keychain through a Tauri command, deliberately not by SQLite. The key is a
 * live credential with billing attached; the database is what `exportDatabaseJson` serialises
 * wholesale, and a key stored there would ride along in every backup with no way to notice.
 * Keeping it outside that boundary means there is no carve-out to remember.
 *
 * Outside Tauri — tests, `vite dev` in a plain browser — there is no keychain, so this reports
 * "unavailable" rather than silently falling back to something less safe.
 */
export interface ApiKeyStore {
  /** True when a keychain is reachable. False in a browser or a test. */
  available: boolean;
  load(): Promise<string | null>;
  /** An empty string clears the key. */
  save(key: string): Promise<void>;
  clear(): Promise<void>;
}

export function createApiKeyStore(): ApiKeyStore {
  if (!isTauriRuntime()) return unavailableStore;

  return {
    available: true,
    async load() {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<string | null>("load_api_key");
    },
    async save(key) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_api_key", { key });
    },
    async clear() {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("delete_api_key");
    },
  };
}

const unavailableStore: ApiKeyStore = {
  available: false,
  async load() {
    return null;
  },
  async save() {
    throw new Error("The keychain is only available in the desktop app.");
  },
  async clear() {
    // Nothing was ever stored, so the caller already has what it asked for.
  },
};

/**
 * A short, non-reversible hint for the UI — never the key itself.
 *
 * Showing the whole key would put a working credential on screen for a screenshot or a
 * screen-share to catch, and there is no reason to: the user only needs to recognise which
 * key is set.
 */
export function maskKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed === "") return "";
  if (trimmed.length <= 8) return "•".repeat(trimmed.length);
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

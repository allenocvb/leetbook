import { describe, expect, it } from "vitest";
import { createApiKeyStore, maskKey } from "./apiKeyStore.js";

describe("createApiKeyStore outside Tauri", () => {
  /*
   * jsdom has no keychain. Reporting that plainly matters more than it looks: the alternative
   * is a silent fallback to localStorage or SQLite, which would put a live credential
   * somewhere the user was told it would never be.
   */
  it("reports itself unavailable rather than falling back to weaker storage", () => {
    const store = createApiKeyStore();
    expect(store.available).toBe(false);
  });

  it("reads as empty", async () => {
    expect(await createApiKeyStore().load()).toBeNull();
  });

  it("refuses to save instead of pretending to", async () => {
    await expect(createApiKeyStore().save("sk-test")).rejects.toThrow(/desktop app/);
  });

  it("treats clearing as already done", async () => {
    await expect(createApiKeyStore().clear()).resolves.toBeUndefined();
  });
});

describe("maskKey", () => {
  it("shows enough to recognise the key and no more", () => {
    const masked = maskKey("sk-ant-api03-abcdefghijklmnop");
    expect(masked).toBe("sk-ant…mnop");
    // A screenshot or screen-share must not carry a working credential.
    expect(masked).not.toContain("api03");
  });

  it("hides a short key completely rather than mostly revealing it", () => {
    expect(maskKey("short")).toBe("•••••");
  });

  it("returns nothing for an empty key", () => {
    expect(maskKey("   ")).toBe("");
  });
});

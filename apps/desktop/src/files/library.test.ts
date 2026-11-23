import type { SqlExecutor } from "@leetbook/core";
import { invoke } from "@tauri-apps/api/core";
import { expect, it, vi } from "vitest";
import { importLibraryFile } from "./library.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
it("removes a copied file if metadata cannot be saved", async () => {
  vi.mocked(invoke)
    .mockResolvedValueOnce({ name: "notes.pdf", size: 123 })
    .mockResolvedValueOnce(undefined);
  const db = {
    execute: vi.fn().mockRejectedValue(new Error("Disk full")),
    select: vi.fn(),
  } as SqlExecutor;
  await expect(importLibraryFile(db, "/tmp/notes.pdf")).rejects.toThrow("Disk full");
  expect(invoke).toHaveBeenLastCalledWith("discard_library_file", {
    id: expect.any(String),
    name: "notes.pdf",
  });
});

import { createFilesRepo, type SqlExecutor } from "@leetbook/core";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, expect, it, vi } from "vitest";
import { makeDb } from "../test-utils.js";
import { importLibraryFile, importLibrarySources } from "./library.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
beforeEach(() => vi.mocked(invoke).mockReset());

it("removes a copied file if metadata cannot be saved", async () => {
  vi.mocked(invoke)
    .mockResolvedValueOnce({ name: "notes.pdf", size: 123 })
    .mockResolvedValueOnce(undefined);
  const db = {
    execute: vi.fn().mockRejectedValue(new Error("Disk full")),
    select: vi.fn().mockResolvedValue([]),
  } as SqlExecutor;
  await expect(importLibraryFile(db, "/tmp/notes.pdf")).rejects.toThrow("Disk full");
  expect(invoke).toHaveBeenLastCalledWith("discard_library_file", {
    id: expect.any(String),
    name: "notes.pdf",
  });
});

it("recreates a dropped folder's hierarchy and keeps its contents in name order", async () => {
  const db = await makeDb();
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "expand_library_sources") {
      return [
        { kind: "folder", source: "/u/Graphs", folders: ["Graphs"] },
        { kind: "folder", source: "/u/Graphs/BFS", folders: ["Graphs", "BFS"] },
        { kind: "file", source: "/u/Graphs/BFS/grid.pdf", folders: ["Graphs", "BFS"] },
        { kind: "file", source: "/u/Graphs/a.md", folders: ["Graphs"] },
        { kind: "file", source: "/u/Graphs/b.md", folders: ["Graphs"] },
        { kind: "file", source: "/u/loose.txt", folders: [] },
      ];
    }
    const source = (args as { source?: string } | undefined)?.source ?? "";
    return { name: source.split("/").pop(), size: 1 };
  });

  expect(await importLibrarySources(db, ["/u/Graphs", "/u/loose.txt"], null)).toEqual([]);

  const repo = createFilesRepo(db);
  const folders = await repo.listFolders();
  const graphs = folders.find((folder) => folder.name === "Graphs");
  const bfs = folders.find((folder) => folder.name === "BFS");
  expect(graphs?.parentId).toBeNull();
  expect(bfs?.parentId).toBe(graphs?.id);

  const files = await repo.list();
  const inGraphs = files.filter((file) => file.folderId === graphs?.id).map((file) => file.name);
  expect(inGraphs).toEqual(["a.md", "b.md"]);
  expect(files.find((file) => file.name === "grid.pdf")?.folderId).toBe(bfs?.id);
  expect(files.find((file) => file.name === "loose.txt")?.folderId).toBeNull();
});

it("reports files that fail and still saves the rest", async () => {
  const db = await makeDb();
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "expand_library_sources") {
      return [
        { kind: "file", source: "/u/huge.mov", folders: [] },
        { kind: "file", source: "/u/ok.pdf", folders: [] },
      ];
    }
    const source = (args as { source?: string } | undefined)?.source ?? "";
    if (source.endsWith("huge.mov")) throw "Choose a file up to 100 MB";
    return { name: "ok.pdf", size: 1 };
  });
  expect(await importLibrarySources(db, ["/u/huge.mov", "/u/ok.pdf"], null)).toEqual([
    "huge.mov: Choose a file up to 100 MB",
  ]);
  expect((await createFilesRepo(db).list()).map((file) => file.name)).toEqual(["ok.pdf"]);
});

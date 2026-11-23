import { createFilesRepo, type SqlExecutor } from "@leetbook/core";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, expect, it, vi } from "vitest";
import { makeDb } from "../test-utils.js";
import {
  deleteLibraryItem,
  importDroppedFiles,
  importLibraryFile,
  importLibrarySources,
} from "./library.js";

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

it("saves dropped browser files as raw bytes with their name in a header", async () => {
  const db = await makeDb();
  vi.mocked(invoke).mockResolvedValue({ name: "Screenshot 11.03.46\u202fPM.png", size: 3 });
  const file = new File([new Uint8Array([1, 2, 3])], "Screenshot 11.03.46\u202fPM.png", {
    type: "image/png",
  });

  expect(await importDroppedFiles(db, [file], null)).toEqual([]);

  const [command, body, options] = vi.mocked(invoke).mock.calls[0] ?? [];
  expect(command).toBe("save_library_bytes");
  expect(body).toEqual(new Uint8Array([1, 2, 3]));
  expect(options?.headers).toMatchObject({
    "x-library-name": "Screenshot%2011.03.46%E2%80%AFPM.png",
  });
  expect((await createFilesRepo(db).list())[0]?.name).toBe("Screenshot 11.03.46\u202fPM.png");
});

it("deletes a folder's rows and every stored copy inside it", async () => {
  const db = await makeDb();
  const repo = createFilesRepo(db);
  await repo.addFolder({ id: "f", name: "Graphs", parentId: null, createdAt: "1" });
  await repo.add({ id: "a", name: "a.pdf", size: 1, createdAt: "2", folderId: "f" });
  await repo.add({ id: "b", name: "b.pdf", size: 1, createdAt: "3" });
  vi.mocked(invoke).mockResolvedValue(undefined);

  await deleteLibraryItem(db, { kind: "folder", id: "f" });
  expect(invoke).toHaveBeenCalledWith("remove_library_file", { id: "a", name: "a.pdf" });
  expect((await repo.list()).map((file) => file.id)).toEqual(["b"]);

  await deleteLibraryItem(db, { kind: "file", id: "b" });
  expect(invoke).toHaveBeenLastCalledWith("remove_library_file", { id: "b", name: "b.pdf" });
  expect(await repo.list()).toEqual([]);
});

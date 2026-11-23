import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../migrate.js";
import { createTestDb } from "../test-helpers.js";
import {
  createFilesRepo,
  folderTrail,
  isWithinFolder,
  type LibraryFolder,
  reorderIds,
} from "./files.js";

describe("file library", () => {
  const db = createTestDb();
  beforeAll(() => migrate(db));
  afterEach(() => {
    db.raw.exec("DELETE FROM library_files");
    db.raw.exec("DELETE FROM library_folders");
  });

  it("persists same-named files independently and lists newest first", async () => {
    const repo = createFilesRepo(db);
    await repo.add({ id: "first", name: "notes.pdf", size: 20, createdAt: "2026-11-21T10:00:00Z" });
    await repo.add({
      id: "second",
      name: "notes.pdf",
      size: 30,
      createdAt: "2026-11-22T10:00:00Z",
    });
    expect((await createFilesRepo(db).list()).map((file) => file.id)).toEqual(["second", "first"]);
    await expect(repo.add({ id: "bad", name: "", size: -1, createdAt: "today" })).rejects.toThrow(
      "Invalid file metadata",
    );
  });

  it("files uploads into folders and keeps each folder's order separately", async () => {
    const repo = createFilesRepo(db);
    await repo.addFolder({ id: "graphs", name: " Graphs ", parentId: null, createdAt: "t" });
    await repo.add({ id: "a", name: "a.pdf", size: 1, createdAt: "t1", folderId: "graphs" });
    await repo.add({ id: "b", name: "b.pdf", size: 1, createdAt: "t2", folderId: "graphs" });
    await repo.add({ id: "root", name: "c.pdf", size: 1, createdAt: "t3" });

    const files = await repo.list();
    expect(files.filter((f) => f.folderId === "graphs").map((f) => f.id)).toEqual(["b", "a"]);
    expect(files.find((f) => f.id === "root")?.folderId).toBeNull();
    expect((await repo.listFolders())[0]?.name).toBe("Graphs");
  });

  it("persists a manual order", async () => {
    const repo = createFilesRepo(db);
    for (const id of ["x", "y", "z"]) {
      await repo.add({ id, name: `${id}.txt`, size: 1, createdAt: id });
    }
    await repo.reorderFiles(["x", "z", "y"]);
    expect((await repo.list()).map((f) => f.id)).toEqual(["x", "z", "y"]);

    await repo.addFolder({ id: "f1", name: "One", parentId: null, createdAt: "1" });
    await repo.addFolder({ id: "f2", name: "Two", parentId: null, createdAt: "2" });
    await repo.reorderFolders(["f1", "f2"]);
    expect((await repo.listFolders()).map((f) => f.id)).toEqual(["f1", "f2"]);
  });

  it("moves files and folders, refusing to nest a folder in itself", async () => {
    const repo = createFilesRepo(db);
    await repo.addFolder({ id: "outer", name: "Outer", parentId: null, createdAt: "1" });
    await repo.addFolder({ id: "inner", name: "Inner", parentId: "outer", createdAt: "2" });
    await repo.add({ id: "doc", name: "doc.md", size: 1, createdAt: "3" });

    await repo.moveFile("doc", "inner");
    expect((await repo.list())[0]?.folderId).toBe("inner");

    await expect(repo.moveFolder("outer", "inner")).rejects.toThrow("inside itself");
    await expect(repo.moveFolder("outer", "outer")).rejects.toThrow("inside itself");
    await repo.moveFolder("inner", null);
    expect((await repo.listFolders()).find((f) => f.id === "inner")?.parentId).toBeNull();

    await repo.renameFolder("inner", "Renamed");
    expect((await repo.listFolders()).find((f) => f.id === "inner")?.name).toBe("Renamed");
    await expect(repo.renameFolder("inner", "  ")).rejects.toThrow("1–255");
  });
});

describe("folder helpers", () => {
  const folders: LibraryFolder[] = [
    { id: "a", name: "A", parentId: null, position: 0, createdAt: "" },
    { id: "b", name: "B", parentId: "a", position: 0, createdAt: "" },
    { id: "c", name: "C", parentId: "b", position: 0, createdAt: "" },
  ];

  it("walks ancestors", () => {
    expect(isWithinFolder(folders, "c", "a")).toBe(true);
    expect(isWithinFolder(folders, "a", "c")).toBe(false);
    expect(isWithinFolder(folders, null, "a")).toBe(false);
    expect(folderTrail(folders, "c").map((f) => f.name)).toEqual(["A", "B", "C"]);
    expect(folderTrail(folders, null)).toEqual([]);
  });

  it("reorders ids before a target or to the end", () => {
    expect(reorderIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(reorderIds(["a", "b", "c"], "a", null)).toEqual(["b", "c", "a"]);
    expect(reorderIds(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
  });
});

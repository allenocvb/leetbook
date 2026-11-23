import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "../migrate.js";
import { createTestDb } from "../test-helpers.js";
import { createFilesRepo } from "./files.js";

describe("file library", () => {
  const db = createTestDb();
  afterEach(() => db.raw.exec("DELETE FROM library_files"));
  it("persists same-named files independently and lists newest first", async () => {
    await migrate(db);
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
});

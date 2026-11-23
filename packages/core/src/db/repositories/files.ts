import type { SqlExecutor } from "../executor.js";

export interface LibraryFile {
  id: string;
  name: string;
  size: number;
  createdAt: string;
}

/** File bytes live in app storage under id/name; only portable metadata belongs in SQLite. */
export function createFilesRepo(db: SqlExecutor) {
  return {
    list: () =>
      db.select<LibraryFile>(
        "SELECT id, name, size, created_at AS createdAt FROM library_files ORDER BY created_at DESC, id",
      ),
    async add(file: LibraryFile) {
      if (!file.name.trim() || !Number.isSafeInteger(file.size) || file.size < 0) {
        throw new Error("Invalid file metadata");
      }
      await db.execute(
        "INSERT INTO library_files (id, name, size, created_at) VALUES (?, ?, ?, ?)",
        [file.id, file.name, file.size, file.createdAt],
      );
    },
  };
}

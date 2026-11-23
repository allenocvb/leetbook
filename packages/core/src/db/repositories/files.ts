import type { SqlExecutor } from "../executor.js";

export interface LibraryFile {
  id: string;
  name: string;
  size: number;
  createdAt: string;
  /** Containing folder; null at the library root. */
  folderId: string | null;
  /** Manual order among the files of one folder, ascending. */
  position: number;
}

export interface LibraryFolder {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  createdAt: string;
}

export type NewLibraryFile = Omit<LibraryFile, "folderId" | "position"> & {
  folderId?: string | null;
};

export type NewLibraryFolder = Omit<LibraryFolder, "position">;

/** True when `folderId` is `ancestorId` or sits anywhere beneath it. */
export function isWithinFolder(
  folders: readonly LibraryFolder[],
  folderId: string | null,
  ancestorId: string,
): boolean {
  const parents = new Map(folders.map((folder) => [folder.id, folder.parentId]));
  const seen = new Set<string>();
  let current = folderId;
  while (current && !seen.has(current)) {
    if (current === ancestorId) return true;
    seen.add(current);
    current = parents.get(current) ?? null;
  }
  return false;
}

/** The chain of folders from the root down to `folderId`, for breadcrumbs. */
export function folderTrail(
  folders: readonly LibraryFolder[],
  folderId: string | null,
): LibraryFolder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const trail: LibraryFolder[] = [];
  let current = folderId ? byId.get(folderId) : undefined;
  while (current && !trail.includes(current)) {
    trail.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return trail;
}

/** Move `id` to sit before `beforeId` (or last when null) in an ordered id list. */
export function reorderIds(ids: readonly string[], id: string, beforeId: string | null): string[] {
  const rest = ids.filter((candidate) => candidate !== id);
  const index = beforeId === null ? -1 : rest.indexOf(beforeId);
  if (index === -1) return [...rest, id];
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}

const FILE_COLUMNS = "id, name, size, created_at AS createdAt, folder_id AS folderId, position";
const FOLDER_COLUMNS = "id, name, parent_id AS parentId, position, created_at AS createdAt";

/**
 * File bytes live in app storage under id/name; only portable metadata — names, folders and
 * the manual order — belongs in SQLite. New items go to the top of their folder.
 */
export function createFilesRepo(db: SqlExecutor) {
  const topPosition = async (
    table: "library_files" | "library_folders",
    column: string,
    parent: string | null,
  ) => {
    const [row] = await db.select<{ top: number | null }>(
      `SELECT MIN(position) AS top FROM ${table} WHERE ${column} IS ?`,
      [parent],
    );
    return (row?.top ?? 1) - 1;
  };

  const setOrder = async (table: "library_files" | "library_folders", ids: readonly string[]) => {
    for (const [position, id] of ids.entries()) {
      await db.execute(`UPDATE ${table} SET position = ? WHERE id = ?`, [position, id]);
    }
  };

  const listFolders = () =>
    db.select<LibraryFolder>(
      `SELECT ${FOLDER_COLUMNS} FROM library_folders ORDER BY position, created_at, id`,
    );

  return {
    list: () =>
      db.select<LibraryFile>(
        `SELECT ${FILE_COLUMNS} FROM library_files ORDER BY position, created_at DESC, id`,
      ),

    listFolders,

    async add(file: NewLibraryFile) {
      if (!file.name.trim() || !Number.isSafeInteger(file.size) || file.size < 0) {
        throw new Error("Invalid file metadata");
      }
      const folderId = file.folderId ?? null;
      await db.execute(
        "INSERT INTO library_files (id, name, size, created_at, folder_id, position) VALUES (?, ?, ?, ?, ?, ?)",
        [
          file.id,
          file.name,
          file.size,
          file.createdAt,
          folderId,
          await topPosition("library_files", "folder_id", folderId),
        ],
      );
    },

    async addFolder(folder: NewLibraryFolder) {
      const name = folder.name.trim();
      if (!name || name.length > 255) throw new Error("Folder names need 1–255 characters");
      await db.execute(
        "INSERT INTO library_folders (id, name, parent_id, position, created_at) VALUES (?, ?, ?, ?, ?)",
        [
          folder.id,
          name,
          folder.parentId,
          await topPosition("library_folders", "parent_id", folder.parentId),
          folder.createdAt,
        ],
      );
    },

    async renameFolder(id: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 255) throw new Error("Folder names need 1–255 characters");
      await db.execute("UPDATE library_folders SET name = ? WHERE id = ?", [trimmed, id]);
    },

    /** Moves a file into a folder (null for the root), placing it at the top. */
    async moveFile(id: string, folderId: string | null) {
      await db.execute("UPDATE library_files SET folder_id = ?, position = ? WHERE id = ?", [
        folderId,
        await topPosition("library_files", "folder_id", folderId),
        id,
      ]);
    },

    /** Moves a folder under another; refuses to put a folder inside itself. */
    async moveFolder(id: string, parentId: string | null) {
      const folders = await listFolders();
      if (isWithinFolder(folders, parentId, id)) {
        throw new Error("A folder can't be moved inside itself");
      }
      await db.execute("UPDATE library_folders SET parent_id = ?, position = ? WHERE id = ?", [
        parentId,
        await topPosition("library_folders", "parent_id", parentId),
        id,
      ]);
    },

    /** Persist a manual order: `ids` are one folder's files, top to bottom. */
    reorderFiles: (ids: readonly string[]) => setOrder("library_files", ids),

    /** Persist a manual order: `ids` are one folder's subfolders, top to bottom. */
    reorderFolders: (ids: readonly string[]) => setOrder("library_folders", ids),
  };
}

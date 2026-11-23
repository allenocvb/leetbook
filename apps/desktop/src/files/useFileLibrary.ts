import {
  createFilesRepo,
  type LibraryFile,
  type LibraryFolder,
  reorderIds,
  type SqlExecutor,
} from "@leetbook/core";
import { useCallback, useEffect, useState } from "react";

/** Something in the library that can be dragged: a file or a folder. */
export interface LibraryItem {
  kind: "file" | "folder";
  id: string;
}

/**
 * The library's files and folders plus the moves the Files page offers. Every change is written
 * to SQLite first and then re-read, so the table always shows what is actually stored.
 */
export function useFileLibrary(db: SqlExecutor, onError: (message: string) => void) {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const repo = createFilesRepo(db);
    const [nextFiles, nextFolders] = await Promise.all([repo.list(), repo.listFolders()]);
    setFiles(nextFiles);
    setFolders(nextFolders);
  }, [db]);

  useEffect(() => {
    let active = true;
    const repo = createFilesRepo(db);
    void Promise.all([repo.list(), repo.listFolders()])
      .then(([nextFiles, nextFolders]) => {
        if (!active) return;
        setFiles(nextFiles);
        setFolders(nextFolders);
      })
      .catch((reason: unknown) => {
        if (active) onError(String(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [db, onError]);

  const run = useCallback(
    async (change: () => Promise<void>) => {
      try {
        await change();
      } catch (reason) {
        onError(reason instanceof Error ? reason.message : String(reason));
      }
      await reload().catch((reason: unknown) => onError(String(reason)));
    },
    [onError, reload],
  );

  const moveInto = (item: LibraryItem, folderId: string | null) =>
    run(() => {
      const repo = createFilesRepo(db);
      return item.kind === "file"
        ? repo.moveFile(item.id, folderId)
        : repo.moveFolder(item.id, folderId);
    });

  /** Place `item` before `beforeId` (or last) among its siblings in `folderId`. */
  const reorder = (item: LibraryItem, folderId: string | null, beforeId: string | null) =>
    run(() => {
      const repo = createFilesRepo(db);
      if (item.kind === "file") {
        const ids = files.filter((file) => file.folderId === folderId).map((file) => file.id);
        return repo.reorderFiles(reorderIds(ids, item.id, beforeId));
      }
      const ids = folders
        .filter((folder) => folder.parentId === folderId)
        .map((folder) => folder.id);
      return repo.reorderFolders(reorderIds(ids, item.id, beforeId));
    });

  const createFolder = (name: string, parentId: string | null) =>
    run(() =>
      createFilesRepo(db).addFolder({
        id: crypto.randomUUID(),
        name,
        parentId,
        createdAt: new Date().toISOString(),
      }),
    );

  return { files, folders, loading, reload, moveInto, reorder, createFolder };
}

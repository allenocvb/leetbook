import { createFilesRepo, type LibraryFile, type SqlExecutor } from "@leetbook/core";
import { invoke } from "@tauri-apps/api/core";

export async function importLibraryFile(
  db: SqlExecutor,
  source: string,
  folderId: string | null = null,
): Promise<string> {
  const id = crypto.randomUUID();
  const file = await invoke<{ name: string; size: number }>("import_library_file", { source, id });
  try {
    await createFilesRepo(db).add({ ...file, id, folderId, createdAt: new Date().toISOString() });
    return id;
  } catch (error) {
    await invoke("discard_library_file", { id, name: file.name }).catch(() => undefined);
    throw error;
  }
}

export function openLibraryFile(file: LibraryFile) {
  return invoke("open_library_file", { id: file.id, name: file.name });
}

export function fileKind(name: string): string {
  const extension = name.includes(".") ? name.split(".").pop()?.toUpperCase() : "";
  return extension || "File";
}

export function fileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

interface LibrarySource {
  kind: "file" | "folder";
  source: string;
  /** Folder names from the dropped top-level folder down; empty for a loose file. */
  folders: string[];
}

/**
 * Saves dropped or picked paths into the library under `parentId`. Folders are recreated with
 * their hierarchy, and their contents keep the order they had on disk (by name).
 * Returns one message per item that could not be saved; the rest still go in.
 */
export async function importLibrarySources(
  db: SqlExecutor,
  paths: string[],
  parentId: string | null,
): Promise<string[]> {
  const repo = createFilesRepo(db);
  const sources = await invoke<LibrarySource[]>("expand_library_sources", { paths });
  const created = new Map<string, string>();
  const children = new Map<string, { folders: string[]; files: string[] }>();
  const failures: string[] = [];
  const keyOf = (trail: string[]) => trail.join("\u0000");
  const childrenOf = (key: string) => {
    let entry = children.get(key);
    if (!entry) {
      entry = { folders: [], files: [] };
      children.set(key, entry);
    }
    return entry;
  };

  for (const item of sources) {
    const trail = item.kind === "folder" ? item.folders.slice(0, -1) : item.folders;
    const parentKey = keyOf(trail);
    // A folder whose parent failed to save is skipped rather than flattened into the root.
    const parent = trail.length === 0 ? parentId : created.get(parentKey);
    if (parent === undefined) continue;
    const name = item.source.split(/[\\/]/).pop() ?? item.source;
    try {
      if (item.kind === "folder") {
        const id = crypto.randomUUID();
        await repo.addFolder({ id, name, parentId: parent, createdAt: new Date().toISOString() });
        created.set(keyOf(item.folders), id);
        if (trail.length) childrenOf(parentKey).folders.push(id);
      } else {
        const id = await importLibraryFile(db, item.source, parent);
        if (trail.length) childrenOf(parentKey).files.push(id);
      }
    } catch (reason) {
      failures.push(`${name}: ${String(reason)}`);
    }
  }

  for (const entry of children.values()) {
    await repo.reorderFolders(entry.folders);
    await repo.reorderFiles(entry.files);
  }
  return failures;
}

function readBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Saves browser File objects — what WebKit hands the page for a dropped file promise such as
 * the Cmd-Shift-4 thumbnail — into the library. Returns one message per file that failed.
 */
export async function importDroppedFiles(
  db: SqlExecutor,
  files: File[],
  folderId: string | null,
): Promise<string[]> {
  const failures: string[] = [];
  for (const file of files) {
    const id = crypto.randomUUID();
    try {
      const bytes = await readBytes(file);
      const saved = await invoke<{ name: string; size: number }>("save_library_bytes", bytes, {
        headers: { "x-library-id": id, "x-library-name": encodeURIComponent(file.name) },
      });
      try {
        await createFilesRepo(db).add({
          ...saved,
          id,
          folderId,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        await invoke("discard_library_file", { id, name: saved.name }).catch(() => undefined);
        throw error;
      }
    } catch (reason) {
      failures.push(`${file.name}: ${String(reason)}`);
    }
  }
  return failures;
}

/** Deletes a file, or a folder with everything in it, from the library and from disk. */
export async function deleteLibraryItem(
  db: SqlExecutor,
  item: { kind: "file" | "folder"; id: string },
): Promise<void> {
  const repo = createFilesRepo(db);
  const files =
    item.kind === "folder"
      ? await repo.removeFolder(item.id)
      : (await repo.list()).filter((file) => file.id === item.id);
  if (item.kind === "file") await repo.removeFile(item.id);
  // The rows are gone first, so a failed byte removal leaves an orphan copy, never a broken row.
  await Promise.all(
    files.map((file) =>
      invoke("remove_library_file", { id: file.id, name: file.name }).catch(() => undefined),
    ),
  );
}

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

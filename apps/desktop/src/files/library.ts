import { createFilesRepo, type LibraryFile, type SqlExecutor } from "@leetbook/core";
import { invoke } from "@tauri-apps/api/core";

export async function importLibraryFile(db: SqlExecutor, source: string): Promise<void> {
  const id = crypto.randomUUID();
  const file = await invoke<{ name: string; size: number }>("import_library_file", { source, id });
  try {
    await createFilesRepo(db).add({ ...file, id, createdAt: new Date().toISOString() });
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

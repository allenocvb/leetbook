import type { SqlExecutor } from "@leetbook/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useRef, useState } from "react";
import { importDroppedFiles, importLibrarySources } from "./library.js";

/**
 * Getting things into the library: picked or Finder-dropped paths (files and folders) and
 * browser Files from promise drops, all into the open folder. One upload at a time.
 */
export function useLibraryUpload(
  db: SqlExecutor,
  folderId: string | null,
  reload: () => Promise<void>,
  setError: (message: string) => void,
) {
  const working = useRef(false);
  const [busy, setBusy] = useState(false);

  const upload = async (sources: string[] | File[]) => {
    if (working.current || sources.length === 0) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const failures =
        typeof sources[0] === "string"
          ? await importLibrarySources(db, sources as string[], folderId)
          : await importDroppedFiles(db, sources as File[], folderId);
      setError(failures.join(" · "));
    } catch (reason) {
      setError(String(reason));
    } finally {
      await reload().catch(() => undefined);
      working.current = false;
      setBusy(false);
    }
  };

  const choose = async (directory: boolean) => {
    try {
      const selected = await open({
        multiple: true,
        directory,
        title: directory ? "Add folders to LeetBook" : "Add files to LeetBook",
      });
      if (selected) await upload(Array.isArray(selected) ? selected : [selected]);
    } catch (reason) {
      setError(String(reason));
    }
  };

  return { busy, upload, choose };
}

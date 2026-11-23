import { createFilesRepo, type LibraryFile } from "@leetbook/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import { FilesTable } from "../components/files/FilesTable.js";
import { Button } from "../components/ui/Button.js";
import { useDb } from "../db/DbContext.js";
import { importLibraryFile, openLibraryFile } from "../files/library.js";
import { useFileDrop } from "../files/useFileDrop.js";
import "../components/table/ProblemsPage.css";
import "./FilesPage.css";

export function FilesPage() {
  const db = useDb();
  const target = useRef<HTMLElement>(null);
  const working = useRef(false);
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void createFilesRepo(db)
      .list()
      .then((rows) => {
        if (active) setFiles(rows);
      })
      .catch((reason: unknown) => {
        if (active) setError(String(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [db]);

  const upload = async (paths: string[]) => {
    if (working.current || paths.length === 0) return;
    working.current = true;
    setBusy(true);
    setError("");
    const failures: string[] = [];
    try {
      for (const path of paths) {
        try {
          await importLibraryFile(db, path);
        } catch (reason) {
          failures.push(`${path.split(/[\\/]/).pop()}: ${String(reason)}`);
        }
      }
      setFiles(await createFilesRepo(db).list());
      setError(failures.join(" · "));
    } catch (reason) {
      setError(String(reason));
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const dragging = useFileDrop(target, (paths) => void upload(paths), setError);
  const choose = async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
        title: "Add files to LeetBook",
      });
      if (selected) await upload(Array.isArray(selected) ? selected : [selected]);
    } catch (reason) {
      setError(String(reason));
    }
  };
  const openFile = (file: LibraryFile) => {
    setError("");
    void openLibraryFile(file).catch((reason: unknown) =>
      setError(`Could not open ${file.name}: ${String(reason)}`),
    );
  };
  const visible = files.filter((file) =>
    file.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <section
      ref={target}
      className={`problems-page files-page${dragging ? " files-page--dragging" : ""}`}
      aria-label="Files & Notes"
      aria-busy={busy}
    >
      <header className="problems-header">
        <div className="problems-header__top">
          <div className="problems-header__copy">
            <h1>Files & Notes</h1>
            <div className="problems-header__subtitle">
              Your reference shelf, saved on this device.
            </div>
          </div>
          <div className="problems-header__actions">
            <div className="problems-header__search">
              <input
                type="search"
                aria-label="Search files"
                placeholder="Search files"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Button disabled={busy} onClick={() => void choose()}>
              {busy ? "Saving…" : "+ Upload files"}
            </Button>
          </div>
        </div>
        <p className="files-page__hint">
          Drop files here · Double-click a row to open · Up to 100 MB per file
        </p>
        {error && (
          <p className="files-page__error" role="alert">
            {error}
          </p>
        )}
      </header>
      <FilesTable files={visible} loading={loading} filtered={!!query} onOpen={openFile} />
      <div className="files-page__footer" role="status">
        {dragging
          ? "Drop to save a copy"
          : busy
            ? "Saving files locally…"
            : `${files.length} ${files.length === 1 ? "file" : "files"} · Originals stay where they are`}
      </div>
    </section>
  );
}

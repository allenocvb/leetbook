import { folderTrail, type LibraryFile } from "@leetbook/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useRef, useState } from "react";
import { FilesBreadcrumbs } from "../components/files/FilesBreadcrumbs.js";
import { FilesPageHeader } from "../components/files/FilesPageHeader.js";
import { FilesTable } from "../components/files/FilesTable.js";
import { useDb } from "../db/DbContext.js";
import { importLibrarySources, openLibraryFile } from "../files/library.js";
import { placeBefore, siblingIds, stepBefore } from "../files/librarySiblings.js";
import type { DropZone } from "../files/rowDrop.js";
import { useFileDrop } from "../files/useFileDrop.js";
import { type LibraryItem, useFileLibrary } from "../files/useFileLibrary.js";
import "../components/table/ProblemsPage.css";
import "./FilesPage.css";

export function FilesPage() {
  const db = useDb();
  const target = useRef<HTMLElement>(null);
  const working = useRef(false);
  const [error, setError] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [dragged, setDragged] = useState<LibraryItem | null>(null);
  const library = useFileLibrary(db, setError);
  const { files, folders } = library;

  const upload = async (paths: string[]) => {
    if (working.current || paths.length === 0) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      setError((await importLibrarySources(db, paths, folderId)).join(" · "));
    } catch (reason) {
      setError(String(reason));
    } finally {
      await library.reload().catch(() => undefined);
      working.current = false;
      setBusy(false);
    }
  };
  const dragging = useFileDrop(target, (paths) => void upload(paths), setError);
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
  const openFile = (file: LibraryFile) => {
    setError("");
    void openLibraryFile(file).catch((reason: unknown) =>
      setError(`Could not open ${file.name}: ${String(reason)}`),
    );
  };

  const trail = folderTrail(folders, folderId);
  const parentOfCurrent = trail.at(-2)?.id ?? null;
  const search = query.trim().toLowerCase();
  const visibleFolders = folders.filter((folder) =>
    search ? folder.name.toLowerCase().includes(search) : folder.parentId === folderId,
  );
  const visibleFiles = files.filter((file) =>
    search ? file.name.toLowerCase().includes(search) : file.folderId === folderId,
  );
  const folderCounts = new Map<string, number>();
  for (const item of [...files.map((f) => f.folderId), ...folders.map((f) => f.parentId)]) {
    if (item) folderCounts.set(item, (folderCounts.get(item) ?? 0) + 1);
  }

  const dropOnRow = (target: LibraryItem, zone: DropZone) => {
    if (!dragged) return;
    if (zone === "into") void library.moveInto(dragged, target.id);
    else {
      const ids = siblingIds(dragged, folderId, files, folders);
      void library.reorder(dragged, folderId, placeBefore(ids, dragged, target.id, zone));
    }
    setDragged(null);
  };
  const keyMove = (item: LibraryItem, direction: "up" | "down" | "out") => {
    if (direction === "out") {
      if (folderId !== null) void library.moveInto(item, parentOfCurrent);
      return;
    }
    const before = stepBefore(siblingIds(item, folderId, files, folders), item, direction);
    if (before !== undefined) void library.reorder(item, folderId, before);
  };

  return (
    <section
      ref={target}
      className={`problems-page files-page${dragging ? " files-page--dragging" : ""}`}
      aria-label="Files & Notes"
      aria-busy={busy}
    >
      <FilesPageHeader
        query={query}
        busy={busy}
        error={error}
        onQuery={setQuery}
        onUploadFiles={() => void choose(false)}
        onUploadFolder={() => void choose(true)}
        onNewFolder={() => setCreatingFolder(true)}
      >
        <FilesBreadcrumbs
          trail={trail}
          dragged={dragged}
          onOpen={(id) => {
            setQuery("");
            setFolderId(id);
          }}
          onDropItem={(id) => {
            if (dragged) void library.moveInto(dragged, id);
            setDragged(null);
          }}
        />
      </FilesPageHeader>
      <FilesTable
        folders={visibleFolders}
        files={visibleFiles}
        folderCounts={folderCounts}
        loading={library.loading}
        filtered={!!search}
        creatingFolder={creatingFolder}
        dragged={dragged}
        onOpen={openFile}
        onOpenFolder={(folder) => {
          setQuery("");
          setFolderId(folder.id);
        }}
        onCreateFolder={(name) => {
          setCreatingFolder(false);
          void library.createFolder(name, folderId);
        }}
        onCancelFolder={() => setCreatingFolder(false)}
        onDragChange={setDragged}
        onDrop={dropOnRow}
        onKeyMove={keyMove}
      />
      <div className="files-page__footer" role="status">
        {dragging
          ? "Drop to save a copy"
          : busy
            ? "Saving files locally…"
            : `${files.length} ${files.length === 1 ? "file" : "files"} · Drag rows to reorder or into folders · Originals stay where they are`}
      </div>
    </section>
  );
}

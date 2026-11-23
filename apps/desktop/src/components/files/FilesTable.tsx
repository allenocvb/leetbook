import type { LibraryFile, LibraryFolder } from "@leetbook/core";
import { fileKind, fileSize } from "../../files/library.js";
import type { DropZone } from "../../files/rowDrop.js";
import type { LibraryItem } from "../../files/useFileLibrary.js";
import { LibraryRow } from "./LibraryRow.js";
import { NewFolderRow } from "./NewFolderRow.js";

export interface FilesTableProps {
  folders: LibraryFolder[];
  files: LibraryFile[];
  /** Items inside each folder, for its Size column. */
  folderCounts: Map<string, number>;
  loading: boolean;
  filtered: boolean;
  creatingFolder: boolean;
  dragged: LibraryItem | null;
  onOpen: (file: LibraryFile) => void;
  onOpenFolder: (folder: LibraryFolder) => void;
  onCreateFolder: (name: string) => void;
  onCancelFolder: () => void;
  onDragChange: (item: LibraryItem | null) => void;
  onDrop: (target: LibraryItem, zone: DropZone) => void;
  onKeyMove: (item: LibraryItem, direction: "up" | "down" | "out") => void;
  onDelete: (item: LibraryItem) => void;
}

const added = (createdAt: string) => new Date(createdAt).toLocaleDateString();

export function FilesTable(props: FilesTableProps) {
  const { folders, files, folderCounts, loading, filtered, dragged } = props;
  const empty = folders.length === 0 && files.length === 0 && !props.creatingFolder;
  const rowProps = (item: LibraryItem) => ({
    item,
    dragged,
    movable: !filtered,
    onDragStart: () => props.onDragChange(item),
    onDragEnd: () => props.onDragChange(null),
    onDrop: (zone: DropZone) => props.onDrop(item, zone),
    onKeyMove: (direction: "up" | "down" | "out") => props.onKeyMove(item, direction),
    onDelete: () => props.onDelete(item),
  });

  return (
    <div className="files-page__body">
      <table className="files-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col">Size</th>
            <th scope="col">Added</th>
            <th scope="col">
              <span className="files-page__sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {props.creatingFolder && (
            <NewFolderRow onCreate={props.onCreateFolder} onCancel={props.onCancelFolder} />
          )}
          {folders.map((folder) => {
            const count = folderCounts.get(folder.id) ?? 0;
            return (
              <LibraryRow
                key={`folder-${folder.id}`}
                {...rowProps({ kind: "folder", id: folder.id })}
                name={folder.name}
                details={[
                  "Folder",
                  `${count} ${count === 1 ? "item" : "items"}`,
                  added(folder.createdAt),
                ]}
                onOpen={() => props.onOpenFolder(folder)}
              />
            );
          })}
          {files.map((file) => (
            <LibraryRow
              key={file.id}
              {...rowProps({ kind: "file", id: file.id })}
              name={file.name}
              details={[fileKind(file.name), fileSize(file.size), added(file.createdAt)]}
              onOpen={() => props.onOpen(file)}
            />
          ))}
        </tbody>
      </table>
      {empty && (
        <div className="files-page__empty">
          {loading
            ? "Loading files…"
            : filtered
              ? "No files match your search."
              : "A place for your PDFs, screenshots, and study material."}
          {!loading && !filtered && (
            <p>Upload files or a folder, or drag them into this page to get started.</p>
          )}
        </div>
      )}
    </div>
  );
}

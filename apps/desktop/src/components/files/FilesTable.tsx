import type { LibraryFile } from "@leetbook/core";
import { fileKind, fileSize } from "../../files/library.js";
import { Button } from "../ui/Button.js";

export function FilesTable({
  files,
  loading,
  filtered,
  onOpen,
}: {
  files: LibraryFile[];
  loading: boolean;
  filtered: boolean;
  onOpen: (file: LibraryFile) => void;
}) {
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
          {files.map((file) => (
            <tr key={file.id} onDoubleClick={() => onOpen(file)}>
              <td>
                <span className="files-table__name">
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="24"
                    viewBox="0 0 20 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  >
                    <path d="M3 1h9l5 5v17H3zM12 1v6h5M6 12h8M6 16h8" />
                  </svg>
                  <span title={file.name}>{file.name}</span>
                </span>
              </td>
              <td>{fileKind(file.name)}</td>
              <td>{fileSize(file.size)}</td>
              <td>{new Date(file.createdAt).toLocaleDateString()}</td>
              <td>
                <Button
                  variant="ghost"
                  aria-label={`Open ${file.name}`}
                  onClick={() => onOpen(file)}
                >
                  ↗
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {files.length === 0 && (
        <div className="files-page__empty">
          {loading
            ? "Loading files…"
            : filtered
              ? "No files match your search."
              : "A place for your PDFs, screenshots, and study material."}
          {!loading && !filtered && <p>Upload a file or drag one into this page to get started.</p>}
        </div>
      )}
    </div>
  );
}

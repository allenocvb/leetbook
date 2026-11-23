import { useState } from "react";
import { FolderIcon } from "./LibraryIcons.js";

/** Inline name field for a new folder: Enter creates it, Escape or an empty name cancels. */
export function NewFolderRow({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const finish = () => (name.trim() ? onCreate(name.trim()) : onCancel());
  return (
    <tr className="files-table__row files-table__row--new">
      <td colSpan={5}>
        <span className="files-table__name" data-kind="folder">
          <FolderIcon />
          <input
            // biome-ignore lint/a11y/noAutofocus: the row exists only to type this name.
            autoFocus
            className="files-table__name-input"
            aria-label="New folder name"
            placeholder="Untitled folder"
            maxLength={255}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={finish}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                finish();
              } else if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
        </span>
      </td>
    </tr>
  );
}

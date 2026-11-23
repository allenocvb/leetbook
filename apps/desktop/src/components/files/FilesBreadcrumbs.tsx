import type { LibraryFolder } from "@leetbook/core";
import { useState } from "react";
import type { LibraryItem } from "../../files/useFileLibrary.js";

/**
 * Where you are in the library. Each crumb opens that folder and also accepts a dragged row,
 * which is how an item moves back up a level by pointer.
 */
export function FilesBreadcrumbs({
  trail,
  dragged,
  onOpen,
  onDropItem,
}: {
  trail: LibraryFolder[];
  dragged: LibraryItem | null;
  onOpen: (folderId: string | null) => void;
  onDropItem: (folderId: string | null) => void;
}) {
  const crumbs = [{ id: null, name: "All files" }, ...trail];
  return (
    <nav className="files-crumbs" aria-label="Folder path">
      {crumbs.map((crumb, index) => (
        <Crumb
          key={crumb.id ?? "root"}
          name={crumb.name}
          current={index === crumbs.length - 1}
          droppable={!!dragged && dragged.id !== crumb.id && index < crumbs.length - 1}
          onOpen={() => onOpen(crumb.id)}
          onDrop={() => onDropItem(crumb.id)}
        />
      ))}
    </nav>
  );
}

function Crumb(props: {
  name: string;
  current: boolean;
  droppable: boolean;
  onOpen: () => void;
  onDrop: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <>
      <button
        type="button"
        className="files-crumbs__crumb"
        aria-current={props.current ? "page" : undefined}
        data-over={over || undefined}
        onClick={props.onOpen}
        onDragOver={(event) => {
          if (!props.droppable) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          setOver(false);
          if (!props.droppable) return;
          event.preventDefault();
          props.onDrop();
        }}
      >
        {props.name}
      </button>
      {!props.current && (
        <span className="files-crumbs__sep" aria-hidden="true">
          /
        </span>
      )}
    </>
  );
}

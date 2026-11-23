import { type DragEvent, type KeyboardEvent, type ReactNode, useState } from "react";
import { type DropZone, dropZone, LIBRARY_DRAG_TYPE } from "../../files/rowDrop.js";
import type { LibraryItem } from "../../files/useFileLibrary.js";
import { Button } from "../ui/Button.js";
import { FileIcon, FolderIcon } from "./LibraryIcons.js";

export interface LibraryRowProps {
  item: LibraryItem;
  name: string;
  details: [type: string, size: string, added: string];
  /** The item being dragged anywhere in the library, if any. */
  dragged: LibraryItem | null;
  /** False while searching: a filtered list has no meaningful order to change. */
  movable: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: (zone: DropZone) => void;
  /** Keyboard moves: Alt+↑/↓ reorder, Alt+← moves out to the parent folder. */
  onKeyMove: (direction: "up" | "down" | "out") => void;
}

const KEY_MOVES: Record<string, "up" | "down" | "out"> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "out",
};

export function LibraryRow(props: LibraryRowProps) {
  const { item, name, details, dragged, movable } = props;
  const [zone, setZone] = useState<DropZone | null>(null);

  const zoneFor = (event: DragEvent<HTMLTableRowElement>) => {
    if (!dragged || !movable) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = bounds.height ? (event.clientY - bounds.top) / bounds.height : 0.5;
    return dropZone(item, dragged, fraction);
  };

  const keyMove = (event: KeyboardEvent<HTMLTableRowElement>) => {
    const direction = KEY_MOVES[event.key];
    if (!event.altKey || !direction || !movable) return;
    event.preventDefault();
    props.onKeyMove(direction);
  };

  const icon: ReactNode = item.kind === "folder" ? <FolderIcon /> : <FileIcon />;
  return (
    <tr
      draggable={movable}
      data-drop={zone ?? undefined}
      data-dragging={dragged?.id === item.id || undefined}
      className="files-table__row"
      onDoubleClick={props.onOpen}
      onKeyDown={keyMove}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(LIBRARY_DRAG_TYPE, item.id);
        props.onDragStart();
      }}
      onDragEnd={() => {
        setZone(null);
        props.onDragEnd();
      }}
      onDragOver={(event) => {
        const next = zoneFor(event);
        if (next) event.preventDefault();
        if (next !== zone) setZone(next);
      }}
      onDragLeave={() => setZone(null)}
      onDrop={(event) => {
        const next = zoneFor(event);
        setZone(null);
        if (!next) return;
        event.preventDefault();
        props.onDrop(next);
      }}
    >
      <td>
        <span className="files-table__name" data-kind={item.kind}>
          {icon}
          <span title={name}>{name}</span>
        </span>
      </td>
      <td>{details[0]}</td>
      <td>{details[1]}</td>
      <td>{details[2]}</td>
      <td>
        <Button variant="ghost" aria-label={`Open ${name}`} onClick={props.onOpen}>
          {item.kind === "folder" ? "→" : "↗"}
        </Button>
      </td>
    </tr>
  );
}

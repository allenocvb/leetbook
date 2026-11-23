import { Button } from "../ui/Button.js";

/** Inline delete confirmation that replaces a row's actions, like the notes page's delete. */
export function RowConfirm({
  what,
  onCancel,
  onDelete,
}: {
  what: string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="files-table__confirm">
      <span className="files-table__confirm-text">Delete for good?</span>
      <Button
        variant="ghost"
        // biome-ignore lint/a11y/noAutofocus: focus moves to the safe choice when asked to confirm.
        autoFocus
        onClick={onCancel}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        Cancel
      </Button>
      <Button variant="outline" aria-label={`Delete this ${what}`} onClick={onDelete}>
        Delete
      </Button>
    </span>
  );
}

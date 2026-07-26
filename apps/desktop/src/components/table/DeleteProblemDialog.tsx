import { createProblemsRepo } from "@leetbook/core";
import { useState } from "react";
import { useDb } from "../../db/DbContext.js";
import { ProblemDialog } from "../problem/ProblemDialog.js";
import { Button } from "../ui/Button.js";

export interface DeleteProblemDialogProps {
  problemId: string;
  problemTitle: string;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}

/**
 * Table rows confirm in a dialog rather than inline like the notes page: the row's action
 * column is 28px, which cannot hold a Cancel/Delete pair without shoving the grid around.
 */
export function DeleteProblemDialog({
  problemId,
  problemTitle,
  onClose,
  onDeleted,
}: DeleteProblemDialogProps) {
  const db = useDb();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setPending(true);
    setError("");
    try {
      await createProblemsRepo(db).remove(problemId);
      await onDeleted();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Problem could not be deleted.");
      setPending(false);
    }
  };

  return (
    <ProblemDialog title="Delete problem" onClose={onClose}>
      <p className="problem-form__hint">
        Delete <strong>{problemTitle}</strong> and every review, note and schedule attached to it?
        This cannot be undone.
      </p>
      {error && (
        <p className="problem-form__error" role="alert">
          {error}
        </p>
      )}
      <div className="problem-form__actions">
        <Button variant="ghost" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => void remove()}>
          {pending ? "Deleting…" : `Delete ${problemTitle}`}
        </Button>
      </div>
    </ProblemDialog>
  );
}

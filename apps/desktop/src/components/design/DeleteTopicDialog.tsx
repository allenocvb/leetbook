import { createDesignTopicsRepo } from "@leetbook/core";
import { useState } from "react";
import { useDb } from "../../db/DbContext.js";
import { ProblemDialog } from "../problem/ProblemDialog.js";
import { Button } from "../ui/Button.js";

export interface DeleteTopicDialogProps {
  topicId: string;
  topicTitle: string;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}

export function DeleteTopicDialog({
  topicId,
  topicTitle,
  onClose,
  onDeleted,
}: DeleteTopicDialogProps) {
  const db = useDb();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setPending(true);
    setError("");
    try {
      await createDesignTopicsRepo(db).remove(topicId);
      await onDeleted();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Topic could not be deleted.");
      setPending(false);
    }
  };

  return (
    <ProblemDialog title="Delete topic" onClose={onClose}>
      <p className="problem-form__hint">
        Delete <strong>{topicTitle}</strong> and every review, note and schedule attached to it?
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
          {pending ? "Deleting…" : `Delete ${topicTitle}`}
        </Button>
      </div>
    </ProblemDialog>
  );
}

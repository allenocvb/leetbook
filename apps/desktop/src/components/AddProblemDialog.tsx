import { createProblemsRepo } from "@leetbook/core";
import { useDb } from "../db/DbContext.js";
import { ProblemDialog } from "./problem/ProblemDialog.js";
import { ProblemForm } from "./problem/ProblemForm.js";

export { resolveSlug, titleFromSlug } from "./problem/ProblemForm.js";

export interface AddProblemDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function AddProblemDialog({ open, onClose, onSaved }: AddProblemDialogProps) {
  const db = useDb();

  if (!open) return null;

  return (
    <ProblemDialog title="New problem" onClose={onClose}>
      <ProblemForm
        submitLabel="Add problem"
        onCancel={onClose}
        onSubmit={async (input) => {
          await createProblemsRepo(db).upsertBySlug(input, new Date());
          onSaved();
          onClose();
        }}
      />
    </ProblemDialog>
  );
}

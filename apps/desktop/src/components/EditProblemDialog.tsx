import { createProblemsRepo, type Problem } from "@leetbook/core";
import { useDb } from "../db/DbContext.js";
import { ProblemDialog } from "./problem/ProblemDialog.js";
import { ProblemForm } from "./problem/ProblemForm.js";

export interface EditProblemDialogProps {
  problem: Problem;
  onClose: () => void;
  onSaved: (problem: Problem) => void;
}

export function EditProblemDialog({ problem, onClose, onSaved }: EditProblemDialogProps) {
  const db = useDb();

  return (
    <ProblemDialog title="Edit problem" onClose={onClose}>
      <ProblemForm
        initialValue={problem}
        submitLabel="Save changes"
        onCancel={onClose}
        onSubmit={async (input) => {
          const updated = await createProblemsRepo(db).update(problem.id, input);
          onSaved(updated);
          onClose();
        }}
      />
    </ProblemDialog>
  );
}

import {
  createNotesRepo,
  createProblemsRepo,
  createReviewsRepo,
  createSchedulingRepo,
  type Note,
  type Problem,
  type Review,
  type SchedulingState,
} from "@leetbook/core";
import { useEffect, useState } from "react";
import { CodeSnapshot } from "../components/CodeSnapshot.js";
import { EditProblemDialog } from "../components/EditProblemDialog.js";
import { NoteEditor } from "../components/editor/NoteEditor.js";
import { ProblemNotesHeader } from "../components/notes/ProblemNotesHeader.js";
import { Divider } from "../components/ui/Divider.js";
import { useDb } from "../db/DbContext.js";
import { useNoteAutosave } from "../hooks/useNoteAutosave.js";
import "./ProblemNotesPage.css";

export interface ProblemNotesPageProps {
  problemId: string;
  onBack: () => void;
  /** Autosave debounce; tests pass 0. */
  saveDelayMs?: number;
}

export function ProblemNotesPage({ problemId, onBack, saveDelayMs = 600 }: ProblemNotesPageProps) {
  const db = useDb();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [scheduling, setScheduling] = useState<SchedulingState | null>(null);
  const [note, setNote] = useState<Note | null | "loading">("loading");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [editing, setEditing] = useState(false);
  const { saveState, handleChange } = useNoteAutosave(db, problemId, saveDelayMs);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [p, s, n, reviews] = await Promise.all([
        createProblemsRepo(db).getById(problemId),
        createSchedulingRepo(db).get(problemId),
        createNotesRepo(db).get(problemId),
        createReviewsRepo(db).listByProblem(problemId),
      ]);
      if (cancelled) return;
      setProblem(p);
      setScheduling(s);
      setNote(n);
      setReviews(reviews);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, problemId]);

  if (note === "loading") return null;
  if (!problem) return <p className="problem-notes-page__error">Problem not found.</p>;

  const snapshot = reviews.filter((review) => review.codeSnapshot !== null).at(-1) ?? null;

  return (
    <div className="problem-notes-page">
      <div className="problem-notes-page__content">
        <ProblemNotesHeader
          problem={problem}
          scheduling={scheduling}
          reviews={reviews}
          onBack={onBack}
          onEdit={() => setEditing(true)}
        />

        <Divider className="problem-notes-page__divider" />

        <div className="problem-notes-page__document">
          <span
            className="problem-notes-page__save-status"
            data-state={saveState}
            aria-live="polite"
          >
            {saveState === "pending"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Save failed"
                  : ""}
          </span>
          {snapshot && <CodeSnapshot review={snapshot} />}
          <NoteEditor initialContentJson={note?.contentJson ?? null} onChange={handleChange} />
        </div>

        {editing && (
          <EditProblemDialog
            key={problem.id}
            problem={problem}
            onClose={() => setEditing(false)}
            onSaved={setProblem}
          />
        )}
      </div>
    </div>
  );
}

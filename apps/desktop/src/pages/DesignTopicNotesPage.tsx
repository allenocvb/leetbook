import {
  createDesignNotesRepo,
  createDesignReviewsRepo,
  createDesignSchedulingRepo,
  createDesignTopicsRepo,
  type DesignNote,
  type DesignReview,
  type DesignSchedulingState,
  type DesignTopic,
} from "@leetbook/core";
import { useEffect, useState } from "react";
import { DesignTopicDialog } from "../components/design/DesignTopicDialog.js";
import { DesignTopicHeader } from "../components/design/DesignTopicHeader.js";
import { NoteEditor } from "../components/editor/NoteEditor.js";
import { Divider } from "../components/ui/Divider.js";
import { useDb } from "../db/DbContext.js";
import { useDesignNoteAutosave } from "../hooks/useNoteAutosave.js";
import "./ProblemNotesPage.css";

export interface DesignTopicNotesPageProps {
  topicId: string;
  onBack: () => void;
  /** Autosave debounce; tests pass 0. */
  saveDelayMs?: number;
}

/**
 * The same editor, autosave and page shell as a problem's notes.
 *
 * Reusing `NoteEditor` wholesale is the point: headings, code blocks, callouts and the
 * selection bar are as useful for a design write-up as for a LeetCode note, and a second
 * editor would drift.
 */
export function DesignTopicNotesPage({
  topicId,
  onBack,
  saveDelayMs = 600,
}: DesignTopicNotesPageProps) {
  const db = useDb();
  const [topic, setTopic] = useState<DesignTopic | null>(null);
  const [scheduling, setScheduling] = useState<DesignSchedulingState | null>(null);
  const [note, setNote] = useState<DesignNote | null | "loading">("loading");
  const [reviews, setReviews] = useState<DesignReview[]>([]);
  const [editing, setEditing] = useState(false);
  const { saveState, handleChange, discardPending } = useDesignNoteAutosave(
    db,
    topicId,
    saveDelayMs,
  );

  // Stop autosaving before the row disappears, or the unmount flush recreates its note.
  const deleteTopic = async () => {
    await discardPending();
    await createDesignTopicsRepo(db).remove(topicId);
    onBack();
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [t, s, n, r] = await Promise.all([
        createDesignTopicsRepo(db).getById(topicId),
        createDesignSchedulingRepo(db).get(topicId),
        createDesignNotesRepo(db).get(topicId),
        createDesignReviewsRepo(db).listByTopic(topicId),
      ]);
      if (cancelled) return;
      setTopic(t);
      setScheduling(s);
      setNote(n);
      setReviews(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, topicId]);

  if (note === "loading") return null;
  if (!topic) return <p className="problem-notes-page__error">Topic not found.</p>;

  return (
    <div className="problem-notes-page">
      <div className="problem-notes-page__content">
        <DesignTopicHeader
          topic={topic}
          scheduling={scheduling}
          reviews={reviews}
          onBack={onBack}
          onEdit={() => setEditing(true)}
          onDelete={deleteTopic}
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
          <NoteEditor
            initialContentJson={note?.contentJson ?? null}
            onChange={handleChange}
            ariaLabel="Topic notes"
          />
        </div>

        {editing && (
          <DesignTopicDialog
            key={topic.id}
            open
            topicId={topic.id}
            initialValue={{ title: topic.title, prompt: topic.prompt, tags: topic.tags }}
            onClose={() => setEditing(false)}
            onSaved={() => {
              void createDesignTopicsRepo(db)
                .getById(topic.id)
                .then((next) => next && setTopic(next));
            }}
          />
        )}
      </div>
    </div>
  );
}

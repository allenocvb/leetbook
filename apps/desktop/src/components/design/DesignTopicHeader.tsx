import type { DesignReview, DesignSchedulingState, DesignTopic } from "@leetbook/core";
import { useState } from "react";
import { formatDueDate, formatNoteDate } from "../notes/ProblemNotesHeader.js";
import { Button } from "../ui/Button.js";
import "../notes/ProblemNotesHeader.css";
import "./DesignTopicHeader.css";

export interface DesignTopicHeaderProps {
  topic: DesignTopic;
  scheduling: DesignSchedulingState | null;
  reviews: DesignReview[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}

/**
 * Mirrors the problem notes header, minus the fields a design topic does not have: no
 * difficulty, no LeetCode link, no runtime or memory. The prompt takes their place, because
 * it is the thing you actually need to see before recalling anything.
 */
export function DesignTopicHeader({
  topic,
  scheduling,
  reviews,
  onBack,
  onEdit,
  onDelete,
}: DesignTopicHeaderProps) {
  const latestReview = reviews.at(-1) ?? null;
  const reviewCount = scheduling?.reviewCount ?? reviews.length;
  const lastReviewedAt = latestReview?.reviewedAt ?? scheduling?.lastReviewedAt ?? null;

  return (
    <header className="problem-notes-header">
      <button className="problem-notes-header__back" type="button" onClick={onBack}>
        ← System Design
      </button>

      <div className="problem-notes-header__title-row">
        <h1>{topic.title}</h1>
        <div className="problem-notes-header__actions">
          <Button variant="ghost" onClick={onEdit}>
            Edit topic
          </Button>
          <DeleteTopicAction title={topic.title} onDelete={onDelete} />
        </div>
      </div>

      {topic.prompt.trim() !== "" && <p className="design-topic-header__prompt">{topic.prompt}</p>}

      <dl className="problem-notes-header__metadata">
        <dt>Tags</dt>
        <dd className="problem-notes-header__categories">
          {topic.tags.length > 0
            ? topic.tags.map((tag) => (
                <span className="problem-notes-header__chip" key={tag}>
                  {tag}
                </span>
              ))
            : "—"}
        </dd>
        <dt>Next review</dt>
        <dd className="problem-notes-header__next">{formatDueDate(scheduling?.dueAt ?? null)}</dd>
        <dt>Last review</dt>
        <dd className="problem-notes-header__mono">
          {lastReviewedAt
            ? `${formatNoteDate(lastReviewedAt)} · scored ${latestReview?.score ?? "–"} · ${reviewCount} reps`
            : "Not reviewed yet"}
        </dd>
      </dl>
    </header>
  );
}

/** Inline confirm rather than a dialog, matching the problem notes page. */
function DeleteTopicAction({
  title,
  onDelete,
}: {
  title: string;
  onDelete: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Delete topic
      </Button>
    );
  }

  return (
    <>
      <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void Promise.resolve(onDelete()).catch(() => setPending(false));
        }}
      >
        {pending ? "Deleting…" : `Delete ${title}`}
      </Button>
    </>
  );
}

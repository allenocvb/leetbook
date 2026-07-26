import {
  applyReview,
  listDueRows,
  type PerformanceScore,
  previewReview,
  type TableRow,
} from "@leetbook/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReviewSessionState } from "../components/review/ReviewSessionState.js";
import { ReviewSessionView } from "../components/review/ReviewSessionView.js";
import { useDb } from "../db/DbContext.js";
import { useReviewSessionKeyboard } from "../hooks/useReviewSessionKeyboard.js";

export interface ReviewSessionPageProps {
  onExit: () => void;
  onShowNotes?: (problemId: string) => void;
}

interface SessionResult {
  score: PerformanceScore;
}

export function ReviewSessionPage({ onExit, onShowNotes = () => {} }: ReviewSessionPageProps) {
  const db = useDb();
  const pageRef = useRef<HTMLDivElement>(null);
  const previewRequest = useRef(0);
  const [queue, setQueue] = useState<TableRow[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<PerformanceScore | null>(null);
  const [previewDueAt, setPreviewDueAt] = useState<string | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void listDueRows(db, new Date().toISOString()).then((rows) => {
      if (live) setQueue(rows);
    });
    return () => {
      live = false;
    };
  }, [db]);

  const current = queue?.[index] ?? null;
  const done = queue !== null && index >= queue.length;

  useEffect(() => {
    if (current) pageRef.current?.focus();
  }, [current]);

  const select = useCallback(
    (score: PerformanceScore) => {
      if (!current || submitting) return;
      const request = ++previewRequest.current;
      setSelected(score);
      setPreviewDueAt(null);
      setError(null);
      void previewReview(db, current.problemId, score, new Date())
        .then((state) => {
          if (previewRequest.current === request) setPreviewDueAt(state.dueAt);
        })
        .catch(() => {
          if (previewRequest.current === request) {
            setError("Couldn’t preview the next review. Try choosing a score again.");
          }
        });
    },
    [current, db, submitting],
  );

  const confirm = useCallback(() => {
    if (!current || selected === null || submitting) return;
    const score = selected;
    setSubmitting(true);
    setError(null);
    void applyReview(db, { problemId: current.problemId, score }, new Date())
      .then(() => {
        previewRequest.current += 1;
        setResults((previous) => [...previous, { score }]);
        setSelected(null);
        setPreviewDueAt(null);
        setIndex((value) => value + 1);
      })
      .catch(() => setError("Couldn’t save this review. Your session is still here."))
      .finally(() => setSubmitting(false));
  }, [current, db, selected, submitting]);

  useReviewSessionKeyboard({ onExit, onSelect: select, onConfirm: confirm });

  if (queue === null) {
    return <main className="review-session review-session--state" aria-busy="true" />;
  }
  if (queue.length === 0) {
    return (
      <ReviewSessionState
        title="Nothing due"
        description="You’re caught up. Come back tomorrow or add another problem."
        actionLabel="Back to Due Today"
        onAction={onExit}
      />
    );
  }
  if (done) {
    const recalled = results.filter((result) => result.score >= 3).length;
    const restudy = results.filter((result) => result.score <= 1).length;
    return (
      <ReviewSessionState
        title="Session complete"
        description={`${results.length} reviewed · ${recalled} recalled · ${restudy} to re-study`}
        actionLabel="Done"
        onAction={onExit}
        stats={[
          { label: "Reviewed", value: results.length },
          { label: "Recalled", value: recalled },
          { label: "Re-study", value: restudy },
        ]}
      />
    );
  }
  if (!current) return null;

  return (
    <ReviewSessionView
      current={current}
      index={index}
      total={queue.length}
      selected={selected}
      previewDueAt={previewDueAt}
      submitting={submitting}
      error={error}
      pageRef={pageRef}
      onSelect={select}
      onShowNotes={() => onShowNotes(current.problemId)}
      onExit={onExit}
    />
  );
}

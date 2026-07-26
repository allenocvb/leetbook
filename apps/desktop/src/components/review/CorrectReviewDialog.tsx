import {
  type CorrectLatestReviewResult,
  isPerformanceScore,
  type PerformanceScore,
  reviseLatestReview,
} from "@leetbook/core";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useDb } from "../../db/DbContext.js";
import { ProblemDialog } from "../problem/ProblemDialog.js";
import { Button } from "../ui/Button.js";
import { ScorePicker } from "./ScorePicker.js";
import "./ReviewScoreDialog.css";

export interface CorrectReviewDialogProps {
  problemId: string;
  problemTitle: string;
  currentScore: PerformanceScore;
  /** ISO timestamp of the latest review. */
  currentReviewedAt: string;
  currentReviewCount: number;
  onClose: () => void;
  onCorrected: (result: CorrectLatestReviewResult) => void | Promise<void>;
}

/** `2026-07-26T11:40:00.000Z` → `2026-07-26`, the format a date input expects. */
function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Keeps the original time of day. Editing "the date" should not silently move a review to
 * midnight, which would shift the FSRS interval by up to a day.
 */
function withDate(iso: string, date: string): string {
  const next = new Date(iso);
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return iso;
  next.setUTCFullYear(year, month - 1, day);
  return next.toISOString();
}

export function CorrectReviewDialog({
  problemId,
  problemTitle,
  currentScore,
  currentReviewedAt,
  currentReviewCount,
  onClose,
  onCorrected,
}: CorrectReviewDialogProps) {
  const db = useDb();
  const fieldId = useId();
  const [selected, setSelected] = useState<PerformanceScore>(currentScore);
  const [date, setDate] = useState(toDateInput(currentReviewedAt));
  const [reps, setReps] = useState(String(currentReviewCount));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selectedScoreRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedScoreRef.current?.focus();
  }, []);

  const dateChanged = date !== toDateInput(currentReviewedAt);
  const repsChanged = reps !== String(currentReviewCount);
  const dirty = selected !== currentScore || dateChanged || repsChanged;

  const submit = async () => {
    if (!dirty || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await reviseLatestReview(db, problemId, {
        score: selected === currentScore ? undefined : selected,
        reviewedAt: dateChanged ? withDate(currentReviewedAt, date) : undefined,
        reviewCount: repsChanged ? Number(reps) : undefined,
      });
      await onCorrected(result);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review could not be corrected.");
      setSubmitting(false);
    }
  };

  // Digits pick a score, but not while typing into the date or reps fields.
  const handleKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    if (!/^[0-5]$/.test(event.key) || submitting) return;
    const digit = Number(event.key);
    if (!isPerformanceScore(digit)) return;
    event.preventDefault();
    setSelected(digit);
  };

  return (
    <ProblemDialog title="Edit latest review" className="review-score-dialog" onClose={onClose}>
      <fieldset
        className="review-score-dialog__fieldset"
        aria-label="Latest review"
        onKeyDown={handleKeyDown}
      >
        <p className="review-score-dialog__intro">
          Change the latest review for{" "}
          <span className="review-score-dialog__problem">{problemTitle}</span>. Earlier reviews
          remain unchanged and the schedule will be rebuilt.
        </p>
        <ScorePicker
          selected={selected}
          onSelect={setSelected}
          disabled={submitting}
          focusOption={currentScore}
          focusOptionRef={selectedScoreRef}
        />
        <p className="review-score-dialog__hint">Press 0–5 to choose the score</p>

        <div className="review-score-dialog__fields">
          <span>
            <label className="problem-form__label" htmlFor={`${fieldId}-date`}>
              Last review
            </label>
            <input
              id={`${fieldId}-date`}
              className="problem-form__control"
              type="date"
              value={date}
              disabled={submitting}
              onChange={(event) => setDate(event.target.value)}
            />
          </span>
          <span>
            <label className="problem-form__label" htmlFor={`${fieldId}-reps`}>
              Reps
            </label>
            <input
              id={`${fieldId}-reps`}
              className="problem-form__control"
              type="number"
              min={1}
              step={1}
              value={reps}
              disabled={submitting}
              onChange={(event) => setReps(event.target.value)}
            />
          </span>
        </div>

        {error && (
          <p className="review-score-dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="review-score-dialog__actions">
          <Button variant="ghost" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!dirty || submitting} onClick={() => void submit()}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </fieldset>
    </ProblemDialog>
  );
}

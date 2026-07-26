import {
  type CorrectLatestReviewResult,
  correctLatestReview,
  isPerformanceScore,
  type PerformanceScore,
} from "@leetbook/core";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useDb } from "../../db/DbContext.js";
import { ProblemDialog } from "../problem/ProblemDialog.js";
import { Button } from "../ui/Button.js";
import { ScorePicker } from "./ScorePicker.js";
import "./ReviewScoreDialog.css";

export interface CorrectReviewDialogProps {
  problemId: string;
  problemTitle: string;
  currentScore: PerformanceScore;
  onClose: () => void;
  onCorrected: (result: CorrectLatestReviewResult) => void | Promise<void>;
}

export function CorrectReviewDialog({
  problemId,
  problemTitle,
  currentScore,
  onClose,
  onCorrected,
}: CorrectReviewDialogProps) {
  const db = useDb();
  const [selected, setSelected] = useState<PerformanceScore>(currentScore);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selectedScoreRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedScoreRef.current?.focus();
  }, []);

  const submit = async () => {
    if (selected === currentScore || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await correctLatestReview(db, problemId, selected);
      await onCorrected(result);
      onClose();
    } catch {
      setError("Review could not be corrected. Try again.");
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    if (!/^[0-5]$/.test(event.key) || submitting) return;
    const digit = Number(event.key);
    if (!isPerformanceScore(digit)) return;
    event.preventDefault();
    setSelected(digit);
  };

  return (
    <ProblemDialog title="Correct latest review" className="review-score-dialog" onClose={onClose}>
      <fieldset
        className="review-score-dialog__fieldset"
        aria-label="Corrected review score"
        onKeyDown={handleKeyDown}
      >
        <p className="review-score-dialog__intro">
          Change the latest score for{" "}
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
        <p className="review-score-dialog__hint">Press 0–5 to choose the corrected score</p>
        {error && (
          <p className="review-score-dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="review-score-dialog__actions">
          <Button variant="ghost" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={selected === currentScore || submitting} onClick={() => void submit()}>
            {submitting ? "Saving…" : "Save correction"}
          </Button>
        </div>
      </fieldset>
    </ProblemDialog>
  );
}

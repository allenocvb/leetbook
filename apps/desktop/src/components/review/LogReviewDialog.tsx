import {
  type ApplyReviewResult,
  applyReview,
  isPerformanceScore,
  type PerformanceScore,
  type SqlExecutor,
} from "@leetbook/core";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useDb } from "../../db/DbContext.js";
import { ProblemDialog } from "../problem/ProblemDialog.js";
import { Button } from "../ui/Button.js";
import { ScorePicker } from "./ScorePicker.js";
import "./LogReviewDialog.css";

export interface LogReviewDialogProps {
  problemId: string;
  problemTitle: string;
  onClose: () => void;
  onLogged: (result: ApplyReviewResult) => void | Promise<void>;
}

export function LogReviewDialog({
  problemId,
  problemTitle,
  onClose,
  onLogged,
}: LogReviewDialogProps) {
  const db = useDb();
  const [selected, setSelected] = useState<PerformanceScore | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const firstScoreRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstScoreRef.current?.focus();
  }, []);

  const submit = async () => {
    if (selected === null || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await logManualReview(db, problemId, selected);
      await onLogged(result);
      onClose();
    } catch {
      setError("Review could not be logged. Try again.");
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    if (!/^[0-5]$/.test(event.key)) return;
    const digit = Number(event.key);
    if (!isPerformanceScore(digit) || submitting) return;
    event.preventDefault();
    setSelected(digit);
  };

  return (
    <ProblemDialog title="Log review" className="log-review-dialog" onClose={onClose}>
      <fieldset
        className="log-review-dialog__fieldset"
        aria-label="Review score"
        onKeyDown={handleKeyDown}
      >
        <p className="log-review-dialog__intro">
          How well did you recall{" "}
          <span className="log-review-dialog__problem">{problemTitle}?</span>
        </p>
        <ScorePicker
          selected={selected}
          onSelect={setSelected}
          disabled={submitting}
          firstOptionRef={firstScoreRef}
        />
        <p className="log-review-dialog__hint">Press 0–5 to choose a score</p>
        {error && (
          <p className="log-review-dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="log-review-dialog__actions">
          <Button variant="ghost" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={selected === null || submitting} onClick={() => void submit()}>
            {submitting ? "Logging…" : "Log review"}
          </Button>
        </div>
      </fieldset>
    </ProblemDialog>
  );
}

function logManualReview(
  db: SqlExecutor,
  problemId: string,
  score: PerformanceScore,
): Promise<ApplyReviewResult> {
  return applyReview(db, { problemId, score }, new Date());
}

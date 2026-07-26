import type { PerformanceScore } from "@leetbook/core";
import { type Ref, useState } from "react";
import "./ScorePicker.css";

export const SCORE_LABELS: Record<PerformanceScore, string> = {
  0: "Blackout",
  1: "Familiar",
  2: "Hinted",
  3: "Struggled",
  4: "Hesitant",
  5: "Perfect",
};

export const SCORE_RUBRIC: Record<PerformanceScore, string> = {
  0: "Complete blackout — couldn't recall approach or solution.",
  1: "Incorrect, but the approach felt familiar once seen.",
  2: "Incorrect, but knew the general approach after a hint.",
  3: "Correct, but with significant effort or struggle.",
  4: "Correct after some hesitation or minor stumbling.",
  5: "Perfect recall — solved smoothly and confidently.",
};

export const ALL_SCORES: PerformanceScore[] = [0, 1, 2, 3, 4, 5];

export interface ScorePickerProps {
  selected: PerformanceScore | null;
  onSelect: (score: PerformanceScore) => void;
  disabled?: boolean;
  focusOption?: PerformanceScore;
  focusOptionRef?: Ref<HTMLButtonElement>;
}

/** The 0–5 chip row. The rubric for the selected score stays visible below. */
export function ScorePicker({
  selected,
  onSelect,
  disabled = false,
  focusOption,
  focusOptionRef,
}: ScorePickerProps) {
  const [hovered, setHovered] = useState<PerformanceScore | null>(null);
  const rubricScore = hovered ?? selected;

  return (
    <div className="score-picker">
      <div className="score-picker__options">
        {ALL_SCORES.map((score) => {
          const active = score === selected;
          return (
            <button
              key={score}
              type="button"
              className="score-picker__option"
              aria-pressed={active}
              disabled={disabled}
              ref={score === focusOption ? focusOptionRef : undefined}
              onClick={() => onSelect(score)}
              onMouseEnter={() => setHovered(score)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="score-picker__score">{score}</span>
              <span className="score-picker__label">{SCORE_LABELS[score]}</span>
            </button>
          );
        })}
      </div>
      <p className="score-picker__rubric" aria-live="polite">
        {rubricScore !== null
          ? `${rubricScore} — ${SCORE_RUBRIC[rubricScore]}`
          : "Rate your recall: 0–5."}
      </p>
    </div>
  );
}

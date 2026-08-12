import type { PerformanceScore } from "@leetbook/core";
import { Button } from "../ui/Button.js";
import "./GradeSuggestion.css";

export interface GradeSuggestionProps {
  /** Per-question feedback, in question order. */
  results: { prompt: string; suggestedScore: PerformanceScore; reasoning: string }[];
  /** Rounded average across the graded answers. */
  overall: PerformanceScore;
  /** Applies the suggestion to the picker. Still requires the user to press Save. */
  onUse: (score: PerformanceScore) => void;
}

/**
 * What the model thought, offered rather than applied.
 *
 * Nothing here selects a score on the user's behalf. Pre-selecting would make confirmation the
 * default and disagreement the effort, which is the same as letting the model decide — and a
 * lenient grader that pushes a topic weeks out corrupts the schedule silently. The reasoning
 * is shown precisely so the user can disagree with something specific.
 */
export function GradeSuggestion({ results, overall, onUse }: GradeSuggestionProps) {
  return (
    <section className="grade-suggestion" aria-label="AI feedback">
      <header className="grade-suggestion__header">
        <span className="grade-suggestion__label">AI feedback</span>
        <span className="grade-suggestion__overall">suggests {overall}</span>
        <Button variant="outline" onClick={() => onUse(overall)}>
          Use {overall}
        </Button>
      </header>

      <ul className="grade-suggestion__list">
        {results.map((result) => (
          <li className="grade-suggestion__item" key={result.prompt}>
            <span className="grade-suggestion__score">{result.suggestedScore}</span>
            <div>
              <p className="grade-suggestion__prompt">{result.prompt}</p>
              <p className="grade-suggestion__reasoning">{result.reasoning}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="grade-suggestion__caveat">
        A suggestion, not a score. Yours is what gets saved and what the schedule uses — if this
        feels generous, it probably is.
      </p>
    </section>
  );
}

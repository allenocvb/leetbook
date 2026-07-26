import type { Review } from "@leetbook/core";
import { SCORE_LABELS } from "../review/ScorePicker.js";
import { formatNoteDate } from "./ProblemNotesHeader.js";
import "./ReviewHistory.css";

export interface ReviewHistoryProps {
  reviews: Review[];
  onCorrectLatest: () => void;
}

export function ReviewHistory({ reviews, onCorrectLatest }: ReviewHistoryProps) {
  const latestFirst = [...reviews].reverse();

  return (
    <section className="review-history" aria-labelledby="review-history-heading">
      <header className="review-history__header">
        <h2 id="review-history-heading">Review history</h2>
        <span className="review-history__count">
          {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
        </span>
      </header>

      {latestFirst.length === 0 ? (
        <p className="review-history__empty">No reviews logged yet.</p>
      ) : (
        <ol className="review-history__list">
          {latestFirst.map((review, index) => (
            <li className="review-history__item" key={review.id}>
              <span className="review-history__score" data-band={scoreBand(review.score)}>
                {review.score}
              </span>
              <span className="review-history__date">{formatNoteDate(review.reviewedAt)}</span>
              <span className="review-history__details">{reviewDetails(review)}</span>
              {index === 0 && (
                <button className="review-history__correct" type="button" onClick={onCorrectLatest}>
                  Edit latest review
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function scoreBand(score: Review["score"]): "low" | "middle" | "high" {
  if (score <= 1) return "low";
  if (score <= 3) return "middle";
  return "high";
}

function reviewDetails(review: Review): string {
  const details = [SCORE_LABELS[review.score]];
  if (review.language) details.push(review.language);
  if (review.runtimeMs !== null) details.push(`${review.runtimeMs} ms`);
  if (review.memoryMb !== null) details.push(`${review.memoryMb} MB`);
  return details.join(" · ");
}

import { Button } from "../ui/Button.js";
import "./DueDesignBanner.css";

export interface DueDesignBannerProps {
  count: number;
  onReview: () => void;
}

/**
 * Tells Due Today that design topics are also waiting.
 *
 * Design topics are deliberately *not* mixed into the problem table. They have no difficulty,
 * no slug and no LeetCode link, so half the columns would be empty, and they are reviewed
 * through a different session with a quiz in it. A banner keeps the schedule honest — nothing
 * due is hidden — without pretending the two are the same kind of thing.
 */
export function DueDesignBanner({ count, onReview }: DueDesignBannerProps) {
  if (count === 0) return null;

  return (
    <aside className="due-design-banner">
      <span className="due-design-banner__text">
        <strong>{count}</strong> system design {count === 1 ? "topic is" : "topics are"} also due.
      </span>
      <Button variant="outline" onClick={onReview}>
        Review design
      </Button>
    </aside>
  );
}

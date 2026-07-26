import { Button } from "../ui/Button.js";
import "./ReviewSessionView.css";

interface ReviewSessionStateProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  stats?: Array<{ label: string; value: number }>;
}

export function ReviewSessionState({
  title,
  description,
  actionLabel,
  onAction,
  stats,
}: ReviewSessionStateProps) {
  return (
    <main className="review-session review-session--state">
      <div className="review-session-state">
        <div className="review-session-state__mark" aria-hidden="true">
          ✓
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
        {stats && (
          <dl className="review-session-state__stats">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    </main>
  );
}

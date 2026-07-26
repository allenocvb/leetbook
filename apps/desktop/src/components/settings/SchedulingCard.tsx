import { MAX_DAILY_NEW_LIMIT } from "../../settings/preferences.js";

export interface SchedulingCardProps {
  dailyNewLimit: number;
  onChangeDailyNewLimit: (value: number) => void;
}

export function SchedulingCard({ dailyNewLimit, onChangeDailyNewLimit }: SchedulingCardProps) {
  return (
    <section className="settings-card" aria-labelledby="scheduling-heading">
      <h2 id="scheduling-heading">Scheduling</h2>
      <dl className="settings-grid">
        <dt>Algorithm</dt>
        <dd className="settings-mono">FSRS · ts-fsrs</dd>
        <dt>Daily new limit</dt>
        <dd className="settings-stepper">
          <button
            type="button"
            aria-label="Decrease daily new limit"
            disabled={dailyNewLimit === 0}
            onClick={() => onChangeDailyNewLimit(dailyNewLimit - 1)}
          >
            −
          </button>
          <output aria-label="Daily new limit">{dailyNewLimit}</output>
          <button
            type="button"
            aria-label="Increase daily new limit"
            disabled={dailyNewLimit === MAX_DAILY_NEW_LIMIT}
            onClick={() => onChangeDailyNewLimit(dailyNewLimit + 1)}
          >
            +
          </button>
        </dd>
        <dt>Score mapping</dt>
        <dd className="settings-score-map">0–1 Again · 2 Hard · 3–4 Good · 5 Easy</dd>
      </dl>
    </section>
  );
}

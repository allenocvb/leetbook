import type { PerformanceScore } from "@leetbook/core";

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
}

/** The 0–5 chip row. The rubric for the selected score stays visible below. */
export function ScorePicker({ selected, onSelect }: ScorePickerProps) {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {ALL_SCORES.map((score) => {
          const active = score === selected;
          return (
            <button
              key={score}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(score)}
              style={{
                width: 72,
                padding: "10px 0 8px",
                borderRadius: 8,
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                background: active ? "var(--accent)" : "var(--bg)",
                color: active ? "#ffffff" : "var(--text)",
                display: "grid",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 600 }}>{score}</span>
              <span style={{ fontSize: 10.5, opacity: active ? 0.9 : 0.6 }}>
                {SCORE_LABELS[score]}
              </span>
            </button>
          );
        })}
      </div>
      <p
        aria-live="polite"
        style={{
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-secondary)",
          background: "var(--surface)",
          borderRadius: 6,
          padding: "10px 14px",
          minHeight: 20,
          marginTop: 16,
        }}
      >
        {selected !== null ? `${selected} — ${SCORE_RUBRIC[selected]}` : "Rate your recall: 0–5."}
      </p>
    </div>
  );
}

import type { Difficulty, ProblemStatus } from "@leetbook/core";

const STATUS_LABEL: Record<ProblemStatus, string> = {
  new: "New",
  learning: "Learning",
  mastered: "Mastered",
  leech: "Leech",
};

export function StatusPill({ status }: { status: ProblemStatus }) {
  return <span className={`pill pill--${status}`}>{STATUS_LABEL[status]}</span>;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function DifficultyText({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`difficulty--${difficulty}`}>{DIFFICULTY_LABEL[difficulty]}</span>;
}

export function ScoreChip({ score }: { score: number | null }) {
  const band = score === null ? "" : score <= 1 ? "low" : score <= 3 ? "middle" : "high";
  return <span className={`score-chip${band ? ` score-chip--${band}` : ""}`}>{score ?? "–"}</span>;
}

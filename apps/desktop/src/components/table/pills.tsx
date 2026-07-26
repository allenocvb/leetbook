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
  return <span className="score-chip">{score ?? "—"}</span>;
}

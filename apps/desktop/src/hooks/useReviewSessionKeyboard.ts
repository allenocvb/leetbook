import { isPerformanceScore, type PerformanceScore } from "@leetbook/core";
import { useEffect } from "react";

interface ReviewSessionKeyboardOptions {
  onExit: () => void;
  onSelect: (score: PerformanceScore) => void;
  onConfirm: () => void;
}

/** Global review shortcuts, while preserving native Enter behavior on unrelated controls. */
export function useReviewSessionKeyboard({
  onExit,
  onSelect,
  onConfirm,
}: ReviewSessionKeyboardOptions) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
        return;
      }
      if (/^[0-5]$/.test(event.key)) {
        event.preventDefault();
        const digit = Number(event.key);
        if (isPerformanceScore(digit)) onSelect(digit);
        return;
      }
      if (event.key !== "Enter") return;

      const target = event.target;
      const scoreButton =
        target instanceof HTMLElement && target.closest(".score-picker__option") !== null;
      const otherControl =
        target instanceof HTMLElement &&
        target.closest("button, a, input, textarea, select, [contenteditable='true']") !== null;
      if (otherControl && !scoreButton) return;
      event.preventDefault();
      onConfirm();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onConfirm, onExit, onSelect]);
}

import { LogoMark } from "../ui/LogoMark.js";
import "./window.css";

export interface IntroScreenProps {
  problemCount: number;
  dueCount: number;
  onStart: () => void;
}

export function IntroScreen({ problemCount, dueCount, onStart }: IntroScreenProps) {
  return (
    <main className="intro">
      <LogoMark size={54} />
      <h1 className="intro__title">LeetBook</h1>
      <p className="intro__tagline">Spaced repetition and notebook-shaped notes for LeetCode.</p>
      <button type="button" className="intro__start" onClick={onStart}>
        Le(e)t&apos;s Code
      </button>
      <p className="intro__stats" aria-live="polite">
        {problemCount} problems · {dueCount} due today
      </p>
    </main>
  );
}

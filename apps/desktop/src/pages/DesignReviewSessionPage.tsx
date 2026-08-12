import {
  applyDesignReview,
  createDesignQuestionsRepo,
  type DesignQuestion,
  type DesignTableRow,
  listDueDesignRows,
  mapScoreToRating,
  type PerformanceScore,
} from "@leetbook/core";
import { useCallback, useEffect, useState } from "react";
import { createAnthropicProvider } from "../ai/anthropic.js";
import { createApiKeyStore } from "../ai/apiKeyStore.js";
import type { QuizProvider } from "../ai/quizProvider.js";
import { DesignQuizStage, scoreChoices } from "../components/design/DesignQuizStage.js";
import { GradeSuggestion } from "../components/design/GradeSuggestion.js";
import { ReviewSessionState } from "../components/review/ReviewSessionState.js";
import { ScorePicker } from "../components/review/ScorePicker.js";
import { Button } from "../components/ui/Button.js";
import { useDb } from "../db/DbContext.js";
import "../components/review/ReviewSessionView.css";
import "../components/design/DesignQuizStage.css";

export interface DesignReviewSessionPageProps {
  onExit: () => void;
  onShowNotes?: (topicId: string) => void;
  /** Injected in tests. Null means no key is set, and grading is simply not offered. */
  loadProvider?: () => Promise<QuizProvider | null>;
}

interface GradeResult {
  prompt: string;
  suggestedScore: PerformanceScore;
  reasoning: string;
}

async function defaultLoadProvider(): Promise<QuizProvider | null> {
  const key = await createApiKeyStore().load();
  return key ? createAnthropicProvider({ apiKey: key }) : null;
}

/**
 * Review session for system design topics.
 *
 * Same shape as the LeetCode session — progress bar, one subject at a time, 0–5 at the end,
 * summary — with a quiz in the middle. The score is always **yours**: multiple choice is
 * graded locally and shown as a tally, but it never becomes the rating. A tally measures the
 * questions you happened to write; the rating is about whether you could actually design the
 * thing, which only you can judge.
 */
export function DesignReviewSessionPage({
  onExit,
  onShowNotes = () => {},
  loadProvider = defaultLoadProvider,
}: DesignReviewSessionPageProps) {
  const db = useDb();
  const [queue, setQueue] = useState<DesignTableRow[] | null>(null);
  const [index, setIndex] = useState(0);
  const [questions, setQuestions] = useState<DesignQuestion[]>([]);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [written, setWritten] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<PerformanceScore | null>(null);
  const [scores, setScores] = useState<PerformanceScore[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grades, setGrades] = useState<GradeResult[] | null>(null);
  const [grading, setGrading] = useState(false);
  const [canGrade, setCanGrade] = useState(false);

  // Whether a key exists at all. No key simply means the button never appears.
  useEffect(() => {
    let live = true;
    void loadProvider()
      .then((provider) => {
        if (live) setCanGrade(provider !== null);
      })
      .catch(() => {
        if (live) setCanGrade(false);
      });
    return () => {
      live = false;
    };
  }, [loadProvider]);

  useEffect(() => {
    let live = true;
    void listDueDesignRows(db, new Date().toISOString()).then((rows) => {
      if (live) setQueue(rows);
    });
    return () => {
      live = false;
    };
  }, [db]);

  const current = queue?.[index] ?? null;
  const done = queue !== null && index >= queue.length;

  // Questions belong to the topic on screen, so they reload whenever it changes.
  useEffect(() => {
    if (!current) return;
    let live = true;
    void createDesignQuestionsRepo(db)
      .listByTopic(current.topicId)
      .then((list) => {
        if (!live) return;
        setQuestions(list);
        setChoices({});
        setWritten({});
        setRevealed(false);
        setSelected(null);
        setGrades(null);
      });
    return () => {
      live = false;
    };
  }, [db, current]);

  const confirm = useCallback(() => {
    if (!current || selected === null || submitting) return;
    const score = selected;
    setSubmitting(true);
    setError(null);
    void applyDesignReview(db, { topicId: current.topicId, score }, new Date())
      .then(() => {
        setScores((previous) => [...previous, score]);
        setIndex((value) => value + 1);
      })
      .catch(() => setError("Couldn’t save this review. Your session is still here."))
      .finally(() => setSubmitting(false));
  }, [current, db, selected, submitting]);

  if (queue === null) {
    return <main className="review-session review-session--state" aria-busy="true" />;
  }
  if (queue.length === 0) {
    return (
      <ReviewSessionState
        title="Nothing due"
        description="No design topics are due. Come back tomorrow or add another topic."
        actionLabel="Back to System Design"
        onAction={onExit}
      />
    );
  }
  if (done) {
    const recalled = scores.filter((score) => score >= 3).length;
    const restudy = scores.filter((score) => score <= 1).length;
    return (
      <ReviewSessionState
        title="Session complete"
        description={`${scores.length} reviewed · ${recalled} recalled · ${restudy} to re-study`}
        actionLabel="Done"
        onAction={onExit}
        stats={[
          { label: "Reviewed", value: scores.length },
          { label: "Recalled", value: recalled },
          { label: "Re-study", value: restudy },
        ]}
      />
    );
  }
  if (!current) return null;

  const tally = scoreChoices(questions, choices);
  const answered = questions.filter(
    (question) => question.kind === "text" && (written[question.id] ?? "").trim() !== "",
  );

  const grade = async () => {
    setGrading(true);
    setError(null);
    try {
      const provider = await loadProvider();
      if (!provider) return;

      const results: GradeResult[] = [];
      for (const question of answered) {
        const graded = await provider.gradeAnswer({
          question: question.prompt,
          modelAnswer: question.modelAnswer,
          answer: written[question.id] ?? "",
        });
        results.push({ prompt: question.prompt, ...graded });
      }
      setGrades(results);
    } catch (cause) {
      // Grading is optional, so a failure must never block the review behind it.
      setError(
        `Couldn't grade: ${cause instanceof Error ? cause.message : String(cause)}. Rate it yourself.`,
      );
    } finally {
      setGrading(false);
    }
  };

  const overall = ((): PerformanceScore => {
    if (!grades || grades.length === 0) return 0;
    const mean = grades.reduce((sum, g) => sum + g.suggestedScore, 0) / grades.length;
    return Math.round(mean) as PerformanceScore;
  })();

  return (
    <div className="review-session">
      <header className="review-session__topbar">
        <span className="review-session__label">Design review</span>
        <div
          className="review-session__progress"
          role="progressbar"
          aria-label="Review progress"
          aria-valuemin={1}
          aria-valuemax={queue.length}
          aria-valuenow={index + 1}
        >
          <span
            className="review-session__progress-fill"
            style={{ width: `${(index / queue.length) * 100}%` }}
          />
        </div>
        <span className="review-session__count">
          {index + 1} of {queue.length}
        </span>
        <Button variant="ghost" className="review-session__exit" onClick={onExit}>
          Exit
        </Button>
      </header>

      <main className="review-session__stage">
        <div className="review-session__content">
          <div className="review-session__eyebrow">
            Due today{current.tags[0] ? ` · ${current.tags[0]}` : ""}
          </div>
          <h1 className="review-session__title">{current.title}</h1>
          {current.prompt.trim() !== "" && (
            <p className="design-topic-header__prompt">{current.prompt}</p>
          )}
          <div className="review-session__meta">
            <span>last scored {current.lastScore ?? "–"}</span>
            <span aria-hidden="true">·</span>
            <span>{current.reviewCount} reps</span>
          </div>
          <div className="review-session__actions">
            <Button variant="outline" onClick={() => onShowNotes(current.topicId)}>
              Show my notes
            </Button>
            {questions.length > 0 && !revealed && (
              <Button onClick={() => setRevealed(true)}>Show answers</Button>
            )}
            {revealed && canGrade && answered.length > 0 && grades === null && (
              <Button variant="outline" disabled={grading} onClick={() => void grade()}>
                {grading ? "Grading…" : "Grade my answers"}
              </Button>
            )}
          </div>

          {questions.length > 0 && (
            <section aria-label="Quiz">
              {revealed && tally.total > 0 && (
                <p className="design-quiz__tally">
                  {tally.correct} of {tally.total} multiple choice correct. Your rating below is
                  still your own call.
                </p>
              )}
              <DesignQuizStage
                questions={questions}
                choices={choices}
                written={written}
                revealed={revealed}
                onChoose={(id, value) => setChoices((c) => ({ ...c, [id]: value }))}
                onWrite={(id, value) => setWritten((w) => ({ ...w, [id]: value }))}
              />
            </section>
          )}

          {/*
            Rating is gated behind revealing the answers when there are any. Scoring your
            recall before seeing whether you were right is guesswork, and a guessed score
            feeds straight into the schedule.
          */}
          {grades !== null && grades.length > 0 && (
            <GradeSuggestion results={grades} overall={overall} onUse={setSelected} />
          )}

          {(questions.length === 0 || revealed) && (
            <section className="review-session__rating" aria-labelledby="design-review-question">
              <h2 id="design-review-question">How well did you recall it?</h2>
              <ScorePicker
                key={current.topicId}
                selected={selected}
                onSelect={setSelected}
                disabled={submitting}
              />
              <p className="review-session__preview" aria-live="polite">
                {selected === null
                  ? "Choose 0–5 to schedule the next review."
                  : `${mapScoreToRating(selected)} · saves and moves on`}
              </p>
              <div className="review-session__actions">
                <Button disabled={selected === null || submitting} onClick={confirm}>
                  {submitting ? "Saving…" : "Save and continue"}
                </Button>
              </div>
              {error && (
                <p className="review-session__error" role="alert">
                  {error}
                </p>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

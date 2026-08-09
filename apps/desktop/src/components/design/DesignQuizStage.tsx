import { type DesignQuestion, gradeChoice } from "@leetbook/core";
import "./DesignQuizStage.css";

export interface DesignQuizStageProps {
  questions: DesignQuestion[];
  /** Chosen option index per choice question, keyed by question id. */
  choices: Record<string, number>;
  /** Typed answer per text question, keyed by question id. */
  written: Record<string, string>;
  revealed: boolean;
  onChoose: (questionId: string, index: number) => void;
  onWrite: (questionId: string, value: string) => void;
}

/** Multiple choice answered so far, and how many were right. Local, no network. */
export function scoreChoices(
  questions: DesignQuestion[],
  choices: Record<string, number>,
): { correct: number; total: number } {
  const choiceQuestions = questions.filter((q) => q.kind === "choice");
  return {
    correct: choiceQuestions.filter((q) => gradeChoice(q, choices[q.id] ?? null)).length,
    total: choiceQuestions.length,
  };
}

/**
 * The questions for one topic, all on screen at once rather than one at a time.
 *
 * A design topic's questions are facets of a single problem, not independent cards — seeing
 * them together is closer to how the material is actually recalled, and it keeps the rating
 * at the end about the topic rather than about the last question you happened to see.
 */
export function DesignQuizStage({
  questions,
  choices,
  written,
  revealed,
  onChoose,
  onWrite,
}: DesignQuizStageProps) {
  return (
    <ol className="design-quiz">
      {questions.map((question, index) => {
        const correct =
          question.kind === "choice" && gradeChoice(question, choices[question.id] ?? null);
        return (
          <li className="design-quiz__item" key={question.id}>
            <p className="design-quiz__prompt">
              <span className="design-quiz__number">{index + 1}</span>
              {question.prompt}
            </p>

            {question.kind === "choice" ? (
              <div className="design-quiz__choices">
                {question.choices.map((choice, choiceIndex) => (
                  <label
                    className="design-quiz__choice"
                    key={choice}
                    data-state={
                      // Only ever coloured after reveal: showing right/wrong while answering
                      // would give the answer away.
                      !revealed
                        ? undefined
                        : choiceIndex === question.answerIndex
                          ? "correct"
                          : choices[question.id] === choiceIndex
                            ? "wrong"
                            : undefined
                    }
                  >
                    <input
                      type="radio"
                      name={question.id}
                      checked={choices[question.id] === choiceIndex}
                      disabled={revealed}
                      onChange={() => onChoose(question.id, choiceIndex)}
                    />
                    <span>{choice}</span>
                  </label>
                ))}
                {revealed && (
                  <p className="design-quiz__verdict" data-correct={correct}>
                    {correct ? "Correct" : "Not quite"}
                  </p>
                )}
              </div>
            ) : (
              <textarea
                className="design-quiz__written"
                aria-label={`Your answer to: ${question.prompt}`}
                rows={4}
                value={written[question.id] ?? ""}
                readOnly={revealed}
                placeholder="Write what you remember…"
                onChange={(event) => onWrite(question.id, event.target.value)}
              />
            )}

            {revealed && question.modelAnswer.trim() !== "" && (
              <div className="design-quiz__model">
                <span className="design-quiz__model-label">
                  {question.kind === "choice" ? "Why" : "Model answer"}
                </span>
                <p>{question.modelAnswer}</p>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

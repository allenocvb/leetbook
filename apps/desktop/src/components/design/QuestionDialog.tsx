import {
  createDesignQuestionsRepo,
  type DesignQuestion,
  type DesignQuestionInput,
} from "@leetbook/core";
import { type FormEvent, useId, useState } from "react";
import { useDb } from "../../db/DbContext.js";
import { ProblemDialog } from "../problem/ProblemDialog.js";
import { Button } from "../ui/Button.js";
import "../problem/ProblemForm.css";
import "./QuestionDialog.css";

export interface QuestionDialogProps {
  topicId: string;
  /** Present when editing an existing question. */
  question?: DesignQuestion;
  onClose: () => void;
  onSaved: () => void;
}

const BLANK_CHOICES = ["", "", "", ""];

export function QuestionDialog({ topicId, question, onClose, onSaved }: QuestionDialogProps) {
  const db = useDb();
  const fieldId = useId();
  const [kind, setKind] = useState<"choice" | "text">(question?.kind ?? "choice");
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [modelAnswer, setModelAnswer] = useState(question?.modelAnswer ?? "");
  const [choices, setChoices] = useState<string[]>(
    question?.kind === "choice"
      ? [...question.choices, ...BLANK_CHOICES].slice(0, Math.max(4, question.choices.length))
      : BLANK_CHOICES,
  );
  const [answerIndex, setAnswerIndex] = useState(
    question?.kind === "choice" ? question.answerIndex : 0,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      /*
       * Blank options are dropped before saving, and the correct answer is remapped onto the
       * shortened list. Without the remap, leaving a gap in the middle would silently move
       * which option is marked correct.
       */
      const input: DesignQuestionInput =
        kind === "choice"
          ? (() => {
              const kept = choices.map((c, i) => ({ c, i })).filter(({ c }) => c.trim() !== "");
              return {
                kind: "choice",
                prompt,
                choices: kept.map(({ c }) => c.trim()),
                answerIndex: Math.max(
                  0,
                  kept.findIndex(({ i }) => i === answerIndex),
                ),
                modelAnswer,
              };
            })()
          : { kind: "text", prompt, modelAnswer };

      const repo = createDesignQuestionsRepo(db);
      if (question) await repo.update(question.id, input);
      else await repo.add(topicId, input, new Date());
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setSaving(false);
    }
  };

  return (
    <ProblemDialog title={question ? "Edit question" : "New question"} onClose={onClose}>
      <form className="problem-form" onSubmit={submit}>
        <span className="problem-form__label">Type</span>
        <div className="question-dialog__kinds">
          <Button
            variant={kind === "choice" ? "primary" : "ghost"}
            aria-pressed={kind === "choice"}
            onClick={() => setKind("choice")}
          >
            Multiple choice
          </Button>
          <Button
            variant={kind === "text" ? "primary" : "ghost"}
            aria-pressed={kind === "text"}
            onClick={() => setKind("text")}
          >
            Written answer
          </Button>
        </div>
        <p className="problem-form__hint">
          {kind === "choice"
            ? "Graded on the spot, with no network."
            : "Compared against your model answer — you rate your own recall."}
        </p>

        <label className="problem-form__label" htmlFor={`${fieldId}-prompt`}>
          Question
        </label>
        <textarea
          id={`${fieldId}-prompt`}
          className="problem-form__control problem-form__control--multiline"
          rows={2}
          value={prompt}
          placeholder="Which store fits the short-link mapping?"
          onChange={(event) => setPrompt(event.target.value)}
        />

        {kind === "choice" && (
          <fieldset className="question-dialog__choices">
            <legend className="problem-form__label">Options</legend>
            {choices.map((choice, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity here
              <div className="question-dialog__choice" key={index}>
                <input
                  type="radio"
                  name={`${fieldId}-answer`}
                  aria-label={`Option ${index + 1} is correct`}
                  checked={answerIndex === index}
                  onChange={() => setAnswerIndex(index)}
                />
                <input
                  className="problem-form__control"
                  aria-label={`Option ${index + 1}`}
                  value={choice}
                  onChange={(event) =>
                    setChoices((current) =>
                      current.map((c, i) => (i === index ? event.target.value : c)),
                    )
                  }
                />
              </div>
            ))}
            <p className="problem-form__hint">
              Select the radio beside the correct option. Blank options are ignored.
            </p>
          </fieldset>
        )}

        <label className="problem-form__label" htmlFor={`${fieldId}-model`}>
          {kind === "choice" ? "Why (shown after answering)" : "Model answer"}
        </label>
        <textarea
          id={`${fieldId}-model`}
          className="problem-form__control problem-form__control--multiline"
          rows={3}
          value={modelAnswer}
          onChange={(event) => setModelAnswer(event.target.value)}
        />

        {error && (
          <p className="problem-form__error" role="alert">
            {error}
          </p>
        )}

        <div className="problem-form__actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : question ? "Save changes" : "Add question"}
          </Button>
        </div>
      </form>
    </ProblemDialog>
  );
}

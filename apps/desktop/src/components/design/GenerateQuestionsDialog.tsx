import { createDesignQuestionsRepo, type DesignQuestionInput } from "@leetbook/core";
import { useState } from "react";
import { createAnthropicProvider } from "../../ai/anthropic.js";
import { createApiKeyStore } from "../../ai/apiKeyStore.js";
import { type QuizProvider, QuizProviderError } from "../../ai/quizProvider.js";
import { useDb } from "../../db/DbContext.js";
import { ProblemDialog } from "../problem/ProblemDialog.js";
import { Button } from "../ui/Button.js";
import "../problem/ProblemForm.css";
import "./QuestionDialog.css";

export interface GenerateQuestionsDialogProps {
  topicId: string;
  title: string;
  prompt: string;
  /** The topic's notes as plain text. */
  notes: string;
  onClose: () => void;
  onSaved: () => void;
  /** Injected in tests. Real callers get the keychain-backed Anthropic provider. */
  loadProvider?: () => Promise<QuizProvider | null>;
}

const DEFAULT_COUNT = 5;

async function defaultLoadProvider(): Promise<QuizProvider | null> {
  const key = await createApiKeyStore().load();
  return key ? createAnthropicProvider({ apiKey: key }) : null;
}

/**
 * Drafts questions from a topic's notes, then lets the user keep or discard each one before
 * anything is written.
 *
 * The review step is the point. A model writing straight into stored content is how a bad
 * question becomes permanent — you meet it mid-review months later, with no memory of where
 * it came from. Nothing here saves until the user says so.
 */
export function GenerateQuestionsDialog({
  topicId,
  title,
  prompt,
  notes,
  onClose,
  onSaved,
  loadProvider = defaultLoadProvider,
}: GenerateQuestionsDialogProps) {
  const db = useDb();
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [drafts, setDrafts] = useState<DesignQuestionInput[] | null>(null);
  const [discarded, setDiscarded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const provider = await loadProvider();
      if (!provider) {
        setError("No API key is set. Add one in Settings to use the AI quiz.");
        return;
      }
      setDrafts(await provider.generateQuestions({ title, prompt, notes, count }));
      setDiscarded(new Set());
    } catch (cause) {
      // Every failure says what happened and leaves the topic untouched.
      setError(
        cause instanceof QuizProviderError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : String(cause),
      );
    } finally {
      setBusy(false);
    }
  };

  const keep = (drafts ?? []).filter((_, index) => !discarded.has(index));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const repo = createDesignQuestionsRepo(db);
      for (const question of keep) {
        await repo.add(topicId, question, new Date());
      }
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };

  return (
    <ProblemDialog title="Generate questions" onClose={onClose}>
      {drafts === null ? (
        <div className="problem-form">
          {/*
            Said before the request, not after. This is the one action in the app that sends
            the user's writing somewhere else, and it should never be a surprise.
          */}
          <p className="problem-form__hint">
            This sends <strong>{title}</strong>'s notes to Anthropic and asks for {count} questions.
            Roughly a cent. Nothing is saved until you review the drafts.
          </p>

          <label className="problem-form__label" htmlFor="generate-count">
            How many
          </label>
          <input
            id="generate-count"
            className="problem-form__control"
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />

          {notes.trim() === "" && (
            <p className="problem-form__hint">
              This topic has no notes yet, so the questions will be generic. Writing something first
              gives much better ones.
            </p>
          )}

          {error && (
            <p className="problem-form__error" role="alert">
              {error}
            </p>
          )}

          <div className="problem-form__actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void generate()}>
              {busy ? "Generating…" : "Generate"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="problem-form">
          <p className="problem-form__hint">
            {keep.length} of {drafts.length} will be saved. Discard anything that misses the point —
            you can edit the rest afterwards.
          </p>

          <ul className="generate-drafts">
            {drafts.map((draft, index) => {
              const dropped = discarded.has(index);
              return (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: drafts have no id until saved
                  key={index}
                  className="generate-drafts__item"
                  data-discarded={dropped}
                >
                  <div className="generate-drafts__body">
                    <p className="generate-drafts__prompt">{draft.prompt}</p>
                    {draft.kind === "choice" && (
                      <ul className="generate-drafts__choices">
                        {draft.choices.map((choice, choiceIndex) => (
                          <li key={choice} data-correct={choiceIndex === draft.answerIndex}>
                            {choice}
                          </li>
                        ))}
                      </ul>
                    )}
                    {draft.modelAnswer && (
                      <p className="generate-drafts__model">{draft.modelAnswer}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    aria-label={`${dropped ? "Keep" : "Discard"}: ${draft.prompt}`}
                    onClick={() =>
                      setDiscarded((current) => {
                        const next = new Set(current);
                        if (!next.delete(index)) next.add(index);
                        return next;
                      })
                    }
                  >
                    {dropped ? "Keep" : "Discard"}
                  </Button>
                </li>
              );
            })}
          </ul>

          {error && (
            <p className="problem-form__error" role="alert">
              {error}
            </p>
          )}

          <div className="problem-form__actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy || keep.length === 0} onClick={() => void save()}>
              {busy ? "Saving…" : `Save ${keep.length}`}
            </Button>
          </div>
        </div>
      )}
    </ProblemDialog>
  );
}

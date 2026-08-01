import { createDesignTopicsRepo, type DesignTopicInput } from "@leetbook/core";
import { type FormEvent, useId, useState } from "react";
import { useDb } from "../../db/DbContext.js";
import { ProblemDialog } from "../problem/ProblemDialog.js";
import { Button } from "../ui/Button.js";
import "../problem/ProblemForm.css";

export interface DesignTopicDialogProps {
  open: boolean;
  /** Present when editing; absent when creating. */
  topicId?: string;
  initialValue?: DesignTopicInput;
  onClose: () => void;
  onSaved: () => void;
}

/** Comma-separated in, array out. Normalisation proper happens in the repo. */
function parseTags(value: string): string[] {
  return value.split(",");
}

export function DesignTopicDialog({
  open,
  topicId,
  initialValue,
  onClose,
  onSaved,
}: DesignTopicDialogProps) {
  const db = useDb();
  const fieldId = useId();
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [prompt, setPrompt] = useState(initialValue?.prompt ?? "");
  const [tags, setTags] = useState((initialValue?.tags ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (title.trim() === "") {
      setError("Give the topic a title, e.g. “URL shortener”.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const input: DesignTopicInput = { title, prompt, tags: parseTags(tags) };
      const repo = createDesignTopicsRepo(db);
      if (topicId) await repo.update(topicId, input);
      else await repo.add(input, new Date());
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProblemDialog title={topicId ? "Edit topic" : "New design topic"} onClose={onClose}>
      <form className="problem-form" onSubmit={handleSubmit}>
        <label className="problem-form__label" htmlFor={`${fieldId}-title`}>
          Title
        </label>
        <input
          id={`${fieldId}-title`}
          className="problem-form__control"
          value={title}
          placeholder="URL shortener"
          onChange={(event) => setTitle(event.target.value)}
        />

        <label className="problem-form__label" htmlFor={`${fieldId}-prompt`}>
          Prompt
        </label>
        <textarea
          id={`${fieldId}-prompt`}
          className="problem-form__control problem-form__control--multiline"
          value={prompt}
          rows={3}
          placeholder="Design a URL shortener handling 100M links per day."
          onChange={(event) => setPrompt(event.target.value)}
        />

        <label className="problem-form__label" htmlFor={`${fieldId}-tags`}>
          Tags
        </label>
        {/*
          Free text rather than the canonical dropdown problems use. System design has no
          agreed topic taxonomy to pick from, and inventing one here would bake a guess into
          the UI. The repo still folds together tags that differ only by case or spacing.
        */}
        <input
          id={`${fieldId}-tags`}
          className="problem-form__control"
          value={tags}
          placeholder="Caching, Sharding"
          onChange={(event) => setTags(event.target.value)}
        />
        <p className="problem-form__hint">Separate with commas.</p>

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
            {saving ? "Saving…" : topicId ? "Save changes" : "Add topic"}
          </Button>
        </div>
      </form>
    </ProblemDialog>
  );
}

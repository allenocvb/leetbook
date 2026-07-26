import { CATEGORIES, type Difficulty, type ProblemInput } from "@leetbook/core";
import { type FormEvent, useId, useState } from "react";
import { Button } from "../ui/Button.js";
import "./ProblemForm.css";

export interface ProblemFormProps {
  initialValue?: ProblemInput;
  submitLabel: string;
  onSubmit: (input: ProblemInput) => Promise<void>;
  onCancel: () => void;
}

/** "two-sum" → "Two Sum" — used when the title field is left empty. */
export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Accepts a canonical LeetCode URL or a bare slug like "two-sum". */
export function resolveSlug(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (/^[a-z0-9-]+$/i.test(trimmed)) return trimmed.toLowerCase();

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (!["leetcode.com", "www.leetcode.com"].includes(url.hostname.toLowerCase())) return null;
    return url.pathname.match(/^\/problems\/([a-z0-9-]+)(?:\/|$)/i)?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function ProblemForm({ initialValue, submitLabel, onSubmit, onCancel }: ProblemFormProps) {
  const fieldId = useId();
  const [url, setUrl] = useState(initialValue?.url ?? "");
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(initialValue?.difficulty ?? "easy");
  const [categories, setCategories] = useState<string[]>(initialValue?.tags ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const slug = resolveSlug(url);
    if (!slug) {
      setError("Enter a LeetCode problem URL or slug (e.g. two-sum).");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        slug,
        title: title.trim() || titleFromSlug(slug),
        url: `https://leetcode.com/problems/${slug}/`,
        difficulty,
        tags: categories,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="problem-form" onSubmit={handleSubmit}>
      <label className="problem-form__label" htmlFor={`${fieldId}-url`}>
        LeetCode URL or slug
      </label>
      <input
        id={`${fieldId}-url`}
        className="problem-form__control"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://leetcode.com/problems/two-sum/"
        autoComplete="off"
        /* biome-ignore lint/a11y/noAutofocus: focus belongs on the first field when a modal opens */
        autoFocus
      />

      <label className="problem-form__label" htmlFor={`${fieldId}-title`}>
        Title <span className="problem-form__hint">(optional — derived from slug)</span>
      </label>
      <input
        id={`${fieldId}-title`}
        className="problem-form__control"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Two Sum"
        autoComplete="off"
      />

      <label className="problem-form__label" htmlFor={`${fieldId}-difficulty`}>
        Difficulty
      </label>
      <select
        id={`${fieldId}-difficulty`}
        className="problem-form__control"
        value={difficulty}
        onChange={(event) => setDifficulty(event.target.value as Difficulty)}
      >
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>

      <label className="problem-form__label" htmlFor={`${fieldId}-categories`}>
        Categories <span className="problem-form__hint">(pick from the list)</span>
      </label>
      <select
        id={`${fieldId}-categories`}
        className="problem-form__control"
        value=""
        onChange={(event) => {
          const picked = event.target.value;
          if (picked) setCategories((current) => [...current, picked]);
        }}
      >
        <option value="">Add a category…</option>
        {CATEGORIES.filter((name) => !categories.includes(name)).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {categories.length > 0 && (
        <ul className="problem-form__chips">
          {categories.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="problem-form__chip"
                aria-label={`Remove ${name}`}
                onClick={() => setCategories((current) => current.filter((c) => c !== name))}
              >
                {name} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="problem-form__error" role="alert">
          {error}
        </p>
      )}

      <div className="problem-form__actions">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

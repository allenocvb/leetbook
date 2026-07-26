import { createProblemsRepo, type Difficulty, slugFromUrl } from "@leetbook/core";
import { type FormEvent, useState } from "react";
import { useDb } from "../db/DbContext.js";

export interface AddProblemDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** "two-sum" → "Two Sum" — used when the title field is left empty. */
export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Accepts a full LeetCode URL or a bare slug like "two-sum". */
export function resolveSlug(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const fromUrl = slugFromUrl(trimmed);
  if (fromUrl) return fromUrl;
  return /^[a-z0-9-]+$/i.test(trimmed) ? trimmed.toLowerCase() : null;
}

const field: React.CSSProperties = {
  font: "inherit",
  padding: "6px 10px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  width: "100%",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--text-secondary)",
  margin: "12px 0 4px",
};

export function AddProblemDialog({ open, onClose, onSaved }: AddProblemDialogProps) {
  const db = useDb();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [categories, setCategories] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const slug = resolveSlug(url);
    if (!slug) {
      setError("Enter a LeetCode problem URL or slug (e.g. two-sum).");
      return;
    }
    setSaving(true);
    try {
      await createProblemsRepo(db).upsertBySlug(
        {
          slug,
          title: title.trim() || titleFromSlug(slug),
          url: `https://leetcode.com/problems/${slug}/`,
          difficulty,
          tags: categories
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
        new Date(),
      );
      setUrl("");
      setTitle("");
      setCategories("");
      setError(null);
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17, 17, 17, 0.25)",
        display: "grid",
        placeItems: "center",
      }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New problem"
        style={{
          width: 420,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "0 12px 32px rgba(17, 17, 17, 0.12)",
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>New problem</h2>

        <form onSubmit={handleSubmit}>
          <label style={label} htmlFor="np-url">
            LeetCode URL or slug
          </label>
          <input
            id="np-url"
            style={field}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://leetcode.com/problems/two-sum/"
            /* biome-ignore lint/a11y/noAutofocus: focus belongs on the first field when a modal opens */
            autoFocus
          />

          <label style={label} htmlFor="np-title">
            Title <span style={{ opacity: 0.7 }}>(optional — derived from slug)</span>
          </label>
          <input
            id="np-title"
            style={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Two Sum"
          />

          <label style={label} htmlFor="np-difficulty">
            Difficulty
          </label>
          <select
            id="np-difficulty"
            style={{ ...field, background: "var(--bg)" }}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <label style={label} htmlFor="np-categories">
            Categories <span style={{ opacity: 0.7 }}>(comma separated)</span>
          </label>
          <input
            id="np-categories"
            style={field}
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="Array, Hash Table"
          />

          {error && (
            <p role="alert" style={{ color: "var(--danger)", fontSize: 12, margin: "12px 0 0" }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "6px 14px",
                border: "1px solid var(--border)",
                borderRadius: 6,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                background: "var(--text)",
                color: "var(--bg)",
              }}
            >
              {saving ? "Saving…" : "Add problem"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { type ApiKeyStore, createApiKeyStore, maskKey } from "../../ai/apiKeyStore.js";
import { Button } from "../ui/Button.js";
import "../problem/ProblemForm.css";

export interface AiCardProps {
  /** Injected in tests; defaults to the real keychain-backed store. */
  store?: ApiKeyStore;
}

/**
 * Where the AI quiz is turned on, and where the honest disclosure lives.
 *
 * Off unless a key is set, so the app ships doing nothing over the network. The wording says
 * plainly that notes are sent to Anthropic when questions are generated — the rest of the
 * product promises local-first, and this is the one place that stops being literally true.
 */
export function AiCard({ store }: AiCardProps) {
  const [keyStore] = useState<ApiKeyStore>(() => store ?? createApiKeyStore());
  const [stored, setStored] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void keyStore.load().then((key) => {
      if (live) setStored(key);
    });
    return () => {
      live = false;
    };
  }, [keyStore]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await keyStore.save(draft);
      setStored(draft.trim() === "" ? null : draft.trim());
      setDraft("");
      setMessage("Key saved to your keychain.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await keyStore.clear();
      setStored(null);
      setMessage("Key removed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-card" aria-labelledby="ai-heading">
      <h2 id="ai-heading">AI quiz</h2>

      <dl className="settings-grid">
        <dt>Status</dt>
        <dd>{stored ? "On — a key is set" : "Off — no key set"}</dd>
        <dt>Key</dt>
        {/* Only ever a hint. A full key on screen is one screenshot from being leaked. */}
        <dd className="settings-mono">{stored ? maskKey(stored) : "—"}</dd>
        <dt>Stored in</dt>
        <dd>{keyStore.available ? "Your OS keychain" : "Unavailable outside the desktop app"}</dd>
      </dl>

      <p className="settings-note">
        Generating questions sends that topic's notes to Anthropic. Nothing is sent while you review
        — questions are saved and reused offline. Leave the key empty and the app never contacts
        anyone.
      </p>

      {keyStore.available && (
        <>
          <label className="problem-form__label" htmlFor="ai-key">
            Anthropic API key
          </label>
          <input
            id="ai-key"
            className="problem-form__control"
            type="password"
            autoComplete="off"
            placeholder={stored ? "Enter a new key to replace it" : "sk-ant-…"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="problem-form__actions">
            {stored && (
              <Button variant="ghost" disabled={busy} onClick={() => void clear()}>
                Remove key
              </Button>
            )}
            <Button disabled={busy || draft.trim() === ""} onClick={() => void save()}>
              {busy ? "Saving…" : "Save key"}
            </Button>
          </div>
        </>
      )}

      {message && (
        <p className="settings-note" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

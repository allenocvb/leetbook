import { useState } from "react";
import type { CaptureRuntime } from "../../capture/useCaptureListener.js";
import { Button } from "../ui/Button.js";

export interface ConnectionCardProps {
  capture: CaptureRuntime;
}

function formatCapture(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function ConnectionCard({ capture }: ConnectionCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const listenerReady = capture.listener.state === "listening";
  const extensionReported = listenerReady && capture.queued !== null;
  const headline = extensionReported
    ? "Extension connected"
    : listenerReady
      ? "Listener ready"
      : capture.listener.state === "checking"
        ? "Checking listener"
        : "Extension offline";
  const listener = capture.pairing
    ? `http://127.0.0.1:${capture.pairing.port}`
    : capture.listener.port
      ? `http://127.0.0.1:${capture.listener.port}`
      : "Unavailable";

  const regenerate = async () => {
    setPending(true);
    setMessage(null);
    const succeeded = await capture.regenerateToken();
    setPending(false);
    setConfirming(false);
    setMessage(
      succeeded
        ? "Disconnected. Press Connect in the extension to pair again."
        : "The extension could not be disconnected.",
    );
  };

  return (
    <section className="settings-card" aria-labelledby="connection-heading">
      <div className="settings-connection__status">
        <span
          className={`settings-connection__dot settings-connection__dot--${capture.listener.state}`}
          aria-hidden="true"
        />
        <h2 id="connection-heading">{headline}</h2>
        <span className="settings-connection__last">
          {capture.lastCapture
            ? `last capture ${formatCapture(capture.lastCapture.reviewedAt)}`
            : "no captures yet"}
        </span>
      </div>

      <dl className="settings-grid">
        <dt>Listener</dt>
        <dd className="settings-mono">{listener}</dd>
        <dt>Paired extension</dt>
        <dd className="settings-token">
          <span>{capture.pairing ? "Approve requests when they appear" : "Desktop app only"}</span>
          {!confirming ? (
            <button
              type="button"
              className="settings-link"
              disabled={!capture.pairing}
              onClick={() => setConfirming(true)}
            >
              Disconnect
            </button>
          ) : (
            <span className="settings-token__confirm">
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => void regenerate()} disabled={pending}>
                {pending ? "Disconnecting…" : "Confirm"}
              </Button>
            </span>
          )}
        </dd>
        <dt>Queued</dt>
        <dd className="settings-mono">
          {capture.queued === null
            ? "Waiting for extension"
            : `${capture.queued} payload${capture.queued === 1 ? "" : "s"}`}
        </dd>
      </dl>
      {(message ?? capture.pairingError) && (
        <p className="settings-card__message" role="status">
          {message ?? capture.pairingError}
        </p>
      )}
    </section>
  );
}

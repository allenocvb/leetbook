import { useState } from "react";
import type { CaptureRuntime } from "../capture/useCaptureListener.js";
import { Button } from "../components/ui/Button.js";
import "./CapturePage.css";

export interface CapturePageProps {
  runtime: CaptureRuntime;
}

function listenerCopy(runtime: CaptureRuntime) {
  if (runtime.listener.state === "checking") {
    return { title: "Checking the listener", detail: "Confirming the local capture bridge." };
  }
  if (runtime.listener.state === "listening") {
    return { title: "Ready to capture", detail: "The desktop listener is online." };
  }
  return {
    title: "Listener offline",
    detail: runtime.pairingError ?? "Restart LeetBook to reopen the local capture bridge.",
  };
}

function queueCopy(queued: number | null) {
  if (queued === null) return "Waiting for an extension report";
  if (queued === 0) return "Queue clear";
  return `${queued} capture${queued === 1 ? "" : "s"} waiting in the extension`;
}

function formatCaptureTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function CapturePage({ runtime }: CapturePageProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const status = listenerCopy(runtime);
  const listenerAddress = runtime.pairing
    ? `http://127.0.0.1:${runtime.pairing.port}`
    : runtime.listener.port
      ? `http://127.0.0.1:${runtime.listener.port}`
      : "Unavailable";

  const copyToken = async () => {
    if (!runtime.pairing) return;
    try {
      await navigator.clipboard.writeText(runtime.pairing.token);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="capture-page">
      <header className="capture-page__header">
        <p className="capture-page__eyebrow">Chrome extension</p>
        <h1>Capture</h1>
        <p>Send accepted LeetCode submissions straight into your review queue.</p>
      </header>

      <div className="capture-page__overview">
        <section
          className="capture-card capture-card--status"
          aria-labelledby="capture-status-title"
        >
          <div className="capture-status__heading">
            <span
              className={`capture-status__dot capture-status__dot--${runtime.listener.state}`}
              aria-hidden="true"
            />
            <div>
              <h2 id="capture-status-title">{status.title}</h2>
              <p>{status.detail}</p>
            </div>
          </div>
          <dl className="capture-status__facts">
            <div>
              <dt>Extension queue</dt>
              <dd>{queueCopy(runtime.queued)}</dd>
            </div>
            <div>
              <dt>Last capture</dt>
              <dd>
                {runtime.lastCapture
                  ? `${runtime.lastCapture.title} · ${formatCaptureTime(runtime.lastCapture.reviewedAt)}`
                  : "No captured submission yet"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="capture-card" aria-labelledby="pairing-title">
          <div className="capture-card__heading">
            <div>
              <p className="capture-card__label">Connection</p>
              <h2 id="pairing-title">Pair this desktop</h2>
            </div>
            <span className={`capture-card__badge capture-card__badge--${runtime.listener.state}`}>
              {runtime.listener.state === "listening" ? "Listening" : "Offline"}
            </span>
          </div>
          <dl className="capture-pairing">
            <div>
              <dt>Listener</dt>
              <dd>
                <code>{listenerAddress}</code>
              </dd>
            </div>
            <div>
              <dt>Pairing token</dt>
              <dd className="capture-pairing__token">
                <code>{runtime.pairing?.token ?? "Desktop app only"}</code>
                {runtime.pairing && (
                  <Button variant="ghost" onClick={() => void copyToken()}>
                    {copyState === "copied" ? "Copied" : "Copy"}
                  </Button>
                )}
              </dd>
            </div>
          </dl>
          {copyState === "failed" && (
            <p className="capture-card__message" role="status">
              Copy failed. Select the token and copy it manually.
            </p>
          )}
        </section>
      </div>

      <section className="capture-setup" aria-labelledby="capture-setup-title">
        <div className="capture-setup__intro">
          <p className="capture-card__label">Three quick steps</p>
          <h2 id="capture-setup-title">Set up automatic capture</h2>
          <p>Pair once, then keep LeetBook open while you practice.</p>
        </div>
        <ol>
          <li>
            <span>1</span>
            <div>
              <strong>Load LeetBook Capture</strong>
              <p>Install the Chrome extension and open its Options page.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Enter this port and token</strong>
              <p>Use port {runtime.pairing?.port ?? 7749} and the pairing token shown above.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Rate accepted submissions</strong>
              <p>After an Accepted verdict, choose a score from 0–5 in the capture card.</p>
            </div>
          </li>
        </ol>
        <p className="capture-setup__note">
          If LeetBook is closed, captures stay safely queued in Chrome and retry every minute.
        </p>
      </section>
    </div>
  );
}

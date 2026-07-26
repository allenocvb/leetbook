import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface PairingInfo {
  port: number;
  token: string;
}

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 13 };

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Shows the capture listener address and the token to paste into the extension. */
export function PairingCard() {
  const [info, setInfo] = useState<PairingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inTauri()) {
      setError("Pairing is available in the desktop app.");
      return;
    }
    invoke<PairingInfo>("get_pairing_info")
      .then(setInfo)
      .catch((cause) => setError(String(cause)));
  }, []);

  return (
    <section
      aria-label="Extension pairing"
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "16px 20px",
        maxWidth: 640,
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Extension pairing</h2>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px" }}>
        Install the LeetBook Capture extension, then paste this token into its options so it can
        talk to the app.
      </p>
      {info ? (
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr",
            rowGap: 6,
            columnGap: 16,
            margin: 0,
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          <dt>Listener</dt>
          <dd style={{ ...mono, margin: 0, color: "var(--text)" }}>http://127.0.0.1:{info.port}</dd>
          <dt>Pairing token</dt>
          <dd style={{ ...mono, margin: 0, color: "var(--text)" }}>{info.token}</dd>
        </dl>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>{error ?? "…"}</p>
      )}
    </section>
  );
}

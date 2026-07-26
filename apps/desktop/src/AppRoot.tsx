import type { SqlExecutor } from "@leetbook/core";
import { useEffect, useState } from "react";
import { App } from "./App.js";
import { initDatabase } from "./db/init.js";

/** Boots the database, then renders the app. Rendered only in the real Tauri shell. */
export function AppRoot() {
  const [db, setDb] = useState<SqlExecutor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(setDb)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  if (error) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>LeetBook couldn't open its database</h1>
          <p
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: 12 }}
          >
            {error}
          </p>
        </div>
      </div>
    );
  }
  if (!db) return null;
  return <App db={db} />;
}

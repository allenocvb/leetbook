import { mapScoreToRating } from "@leetbook/core";

export function App() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        background: "#ffffff",
        color: "#111111",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontWeight: 600 }}>LeetBook</h1>
        <p style={{ color: "#666" }}>
          Scaffold is alive. A score of 5 maps to “{mapScoreToRating(5)}”.
        </p>
      </div>
    </main>
  );
}

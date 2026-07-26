import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CaptureRuntime } from "../capture/useCaptureListener.js";
import { CapturePage } from "./CapturePage.js";

const READY: CaptureRuntime = {
  listener: { state: "listening", port: 7749 },
  pairing: { port: 7749, token: "7F2K91QD", listening: true, queued: 2 },
  pairingError: null,
  queued: 2,
  lastCapture: {
    slug: "two-sum",
    title: "Two Sum",
    reviewedAt: "2026-07-25T12:00:00.000Z",
  },
  regenerateToken: async () => true,
  pairPrompt: null,
  resolvePairing: async () => {},
};

describe("CapturePage", () => {
  it("shows live listener, queue, pairing, and last-capture information", () => {
    render(<CapturePage runtime={READY} />);

    expect(screen.getByRole("heading", { name: "Capture" })).toBeInTheDocument();
    expect(screen.getByText("Ready to capture")).toBeInTheDocument();
    expect(screen.getByText("2 captures waiting in the extension")).toBeInTheDocument();
    expect(screen.getByText(/Two Sum/)).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:7749")).toBeInTheDocument();
    // The token is deliberately not shown: it is exchanged through the approval handshake,
    // so surfacing it would only invite the copy-paste flow this replaced.
    expect(screen.queryByText("7F2K91QD")).not.toBeInTheDocument();
    expect(screen.getByText("Approve requests when they appear")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Set up automatic capture" })).toBeInTheDocument();
  });

  it("does not imply a connection or queue count when state is unavailable", () => {
    render(
      <CapturePage
        runtime={{
          listener: { state: "offline", port: null },
          pairing: null,
          pairingError: "Pairing is available in the desktop app.",
          queued: null,
          lastCapture: null,
          regenerateToken: async () => false,
          pairPrompt: null,
          resolvePairing: async () => {},
        }}
      />,
    );

    expect(screen.getByText("Listener offline")).toBeInTheDocument();
    expect(screen.getByText("Waiting for an extension report")).toBeInTheDocument();
    expect(screen.getByText("No captured submission yet")).toBeInTheDocument();
    expect(screen.getByText("Desktop app only")).toBeInTheDocument();
    expect(screen.queryByText("Listening")).not.toBeInTheDocument();
  });
});

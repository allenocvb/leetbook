import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureRuntime } from "../capture/useCaptureListener.js";
import { DbProvider } from "../db/DbContext.js";
import { DAILY_NEW_LIMIT_KEY } from "../settings/preferences.js";
import { makeDb } from "../test-utils.js";
import { SettingsPage } from "./SettingsPage.js";

const regenerateToken = vi.fn(async () => true);
const READY_CAPTURE: CaptureRuntime = {
  listener: { state: "listening", port: 7749 },
  pairing: { port: 7749, token: "7F2K91QD", listening: true, queued: 0 },
  pairingError: null,
  queued: 0,
  lastCapture: {
    slug: "two-sum",
    title: "Two Sum",
    reviewedAt: "2026-07-25T12:00:00.000Z",
  },
  regenerateToken,
  pairPrompt: null,
  resolvePairing: async () => {},
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

async function setup(capture: CaptureRuntime = READY_CAPTURE) {
  const db = await makeDb();
  render(
    <DbProvider db={db}>
      <SettingsPage capture={capture} />
    </DbProvider>,
  );
  await waitFor(() => expect(screen.getByText("FSRS · ts-fsrs")).toBeInTheDocument());
  return { db };
}

describe("SettingsPage", () => {
  it("shows truthful connection, scheduling, and database information", async () => {
    await setup();

    expect(screen.getByText("Extension connected")).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:7749")).toBeInTheDocument();
    // The token is deliberately not shown: it is exchanged through the approval handshake,
    // so surfacing it would only invite the copy-paste flow this replaced.
    expect(screen.queryByText("7F2K91QD")).not.toBeInTheDocument();
    expect(screen.getByText("Approve requests when they appear")).toBeInTheDocument();
    expect(screen.getByText("0 payloads")).toBeInTheDocument();
    expect(screen.getByText("FSRS · ts-fsrs")).toBeInTheDocument();
    expect(screen.getByText("0–2 Again · 3 Hard · 4 Good · 5 Easy")).toBeInTheDocument();
    expect(screen.getByText("90 days")).toBeInTheDocument();
    // The Data card (import/export) was removed from Settings on request.
    expect(screen.queryByText(/Local SQLite/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export JSON" })).not.toBeInTheDocument();
  });

  it("persists changes to the daily new limit", async () => {
    await setup();
    expect(screen.getByLabelText("Daily new limit")).toHaveTextContent("5");

    await userEvent.click(screen.getByRole("button", { name: "Increase daily new limit" }));

    expect(screen.getByLabelText("Daily new limit")).toHaveTextContent("6");
    expect(window.localStorage.getItem(DAILY_NEW_LIMIT_KEY)).toBe("6");
  });

  it("disconnects the paired extension only after confirmation", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(regenerateToken).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(regenerateToken).toHaveBeenCalledTimes(1));
    expect(
      screen.getByText("Disconnected. Press Connect in the extension to pair again."),
    ).toBeInTheDocument();
  });

  it("does not claim the extension is connected without an extension report", async () => {
    await setup({ ...READY_CAPTURE, queued: null });
    expect(screen.getByText("Listener ready")).toBeInTheDocument();
    expect(screen.getByText("Waiting for extension")).toBeInTheDocument();
    expect(screen.queryByText("Extension connected")).not.toBeInTheDocument();
  });
});

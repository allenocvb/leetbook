import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listTableRows } from "@leetbook/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureRuntime } from "../capture/useCaptureListener.js";
import { DbProvider } from "../db/DbContext.js";
import { DAILY_NEW_LIMIT_KEY } from "../settings/preferences.js";
import { makeDb } from "../test-utils.js";
import { SettingsPage } from "./SettingsPage.js";

const saveTextFile = vi.hoisted(() => vi.fn(async () => "/tmp/leetbook-export.json"));
const pickDirectory = vi.hoisted(() => vi.fn(async () => "/tmp/notes"));
const writeFileIn = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("../lib/fileio.js", () => ({ saveTextFile, pickDirectory, writeFileIn }));

const FIXTURE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../packages/core/src/import/__fixtures__/notion-export.csv",
  ),
  "utf8",
);

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
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

async function setup(capture: CaptureRuntime = READY_CAPTURE) {
  const db = await makeDb();
  const onViewProblems = vi.fn();
  render(
    <DbProvider db={db}>
      <SettingsPage capture={capture} onViewProblems={onViewProblems} />
    </DbProvider>,
  );
  await waitFor(() => expect(screen.getByText(/Local SQLite/)).toBeInTheDocument());
  return { db, onViewProblems };
}

describe("SettingsPage", () => {
  it("shows truthful connection, scheduling, and database information", async () => {
    await setup();

    expect(screen.getByText("Extension connected")).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:7749")).toBeInTheDocument();
    expect(screen.getByText("7F2K91QD")).toBeInTheDocument();
    expect(screen.getByText("0 payloads")).toBeInTheDocument();
    expect(screen.getByText("FSRS · ts-fsrs")).toBeInTheDocument();
    expect(screen.getByText("Local SQLite · 0 problems · 0 reviews · 0 notes")).toBeInTheDocument();
  });

  it("persists changes to the daily new limit", async () => {
    await setup();
    expect(screen.getByLabelText("Daily new limit")).toHaveTextContent("5");

    await userEvent.click(screen.getByRole("button", { name: "Increase daily new limit" }));

    expect(screen.getByLabelText("Daily new limit")).toHaveTextContent("6");
    expect(window.localStorage.getItem(DAILY_NEW_LIMIT_KEY)).toBe("6");
  });

  it("regenerates the active pairing token only after confirmation", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(regenerateToken).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(regenerateToken).toHaveBeenCalledTimes(1));
    expect(
      screen.getByText("Token regenerated. Update it in the extension Options page."),
    ).toBeInTheDocument();
  });

  it("does not claim the extension is connected without an extension report", async () => {
    await setup({ ...READY_CAPTURE, queued: null });
    expect(screen.getByText("Listener ready")).toBeInTheDocument();
    expect(screen.getByText("Waiting for extension")).toBeInTheDocument();
    expect(screen.queryByText("Extension connected")).not.toBeInTheDocument();
  });

  it("imports the real Notion export and routes to the imported problems", async () => {
    const { db, onViewProblems } = await setup();
    const file = new File([FIXTURE], "notion-export.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByLabelText("Notion CSV file"), file);

    await waitFor(() => expect(screen.getByText("47 imported")).toBeInTheDocument());
    expect(screen.getByText(/· 0 skipped/)).toBeInTheDocument();
    expect(screen.getByText(/47 problems/)).toBeInTheDocument();
    expect(await listTableRows(db)).toHaveLength(47);

    await userEvent.click(screen.getByRole("button", { name: "View imported problems" }));
    expect(onViewProblems).toHaveBeenCalledTimes(1);
  });

  it("lists skipped rows with reasons", async () => {
    await setup();
    const csv =
      "Name,Status,Next Review,Last Review Date,Performance Score,Review Count,Category,Difficulty,URL\n" +
      "Broken,todo,,,,,Array,Easy,https://example.com/nope\n";
    await userEvent.upload(
      screen.getByLabelText("Notion CSV file"),
      new File([csv], "bad.csv", { type: "text/csv" }),
    );
    await waitFor(() => expect(screen.getByText("0 imported")).toBeInTheDocument());
    expect(
      screen.getByText(/line 2 \(Broken\): missing or invalid LeetCode URL/),
    ).toBeInTheDocument();
  });

  it("exports the database as JSON via the save dialog", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    await waitFor(() => expect(saveTextFile).toHaveBeenCalledTimes(1));
    const [name, contents] = saveTextFile.mock.calls[0] as unknown as [string, string];
    expect(name).toBe("leetbook-export.json");
    expect(JSON.parse(contents).format).toBe("leetbook");
    expect(await screen.findByText(/Exported to \/tmp\/leetbook-export.json/)).toBeInTheDocument();
  });

  it("reports when there are no notes to export as Markdown", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "Export Markdown" }));
    expect(await screen.findByText("No notes to export yet.")).toBeInTheDocument();
    expect(pickDirectory).not.toHaveBeenCalled();
  });
});

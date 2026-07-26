import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createProblemsRepo, createReviewsRepo, listTableRows } from "@leetbook/core";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  pairPrompt: null,
  resolvePairing: async () => {},
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
    // The token is deliberately not shown: it is exchanged through the approval handshake,
    // so surfacing it would only invite the copy-paste flow this replaced.
    expect(screen.queryByText("7F2K91QD")).not.toBeInTheDocument();
    expect(screen.getByText("Approve requests when they appear")).toBeInTheDocument();
    expect(screen.getByText("0 payloads")).toBeInTheDocument();
    expect(screen.getByText("FSRS · ts-fsrs")).toBeInTheDocument();
    expect(screen.getByText("Local SQLite · 0 problems · 0 reviews · 0 notes")).toBeInTheDocument();
    expect(
      screen.getByText(/Notes, code, and full review history are not included/),
    ).toBeInTheDocument();
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

  it("imports the real Notion export and routes to the imported problems", async () => {
    const { db, onViewProblems } = await setup();
    const file = new File([FIXTURE], "notion-export.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByLabelText("Notion CSV file"), file);

    const result = await screen.findByRole("region", { name: "Import result" });
    expect(within(result).getByText("Import complete")).toBeInTheDocument();
    expect(within(result).getByText("47 rows read")).toBeInTheDocument();
    expect(within(result).getByText("Added")).toBeInTheDocument();
    expect(within(result).getByText("47")).toBeInTheDocument();
    expect(within(result).getByText("Skipped")).toBeInTheDocument();
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
    const result = await screen.findByRole("region", { name: "Import result" });
    expect(within(result).getByText("Skipped rows (1)")).toBeInTheDocument();
    expect(within(result).getByText("Line 2 · Broken")).toBeInTheDocument();
    expect(within(result).getByText("missing or invalid LeetCode URL")).toBeInTheDocument();
  });

  it("reports repeated imports as unchanged without duplicating review snapshots", async () => {
    const { db } = await setup();
    const input = screen.getByLabelText("Notion CSV file");
    const file = () => new File([FIXTURE], "notion-export.csv", { type: "text/csv" });

    await userEvent.upload(input, file());
    await screen.findByText("47 rows read");
    await userEvent.upload(input, file());

    const result = await screen.findByRole("region", { name: "Import result" });
    await waitFor(() => expect(within(result).getByText("Unchanged")).toBeInTheDocument());
    expect(within(result).getByText("47")).toBeInTheDocument();
    const problem = await createProblemsRepo(db).getBySlug("contains-duplicate");
    expect(await createReviewsRepo(db).listByProblem(problem?.id ?? "")).toHaveLength(1);
  });

  it("shows non-blocking review snapshot warnings with row details", async () => {
    await setup();
    const csv =
      "Name,Status,Next Review,Last Review Date,Performance Score,Review Count,Category,Difficulty,URL\n" +
      "Two Sum,todo,,not-a-date,8,,Array,Easy,https://leetcode.com/problems/two-sum/\n";
    await userEvent.upload(
      screen.getByLabelText("Notion CSV file"),
      new File([csv], "warning.csv", { type: "text/csv" }),
    );

    const result = await screen.findByRole("region", { name: "Import result" });
    expect(within(result).getByText("Warnings (1)")).toBeInTheDocument();
    expect(within(result).getByText("Line 2 · Two Sum")).toBeInTheDocument();
    expect(within(result).getByText(/review snapshot ignored/)).toBeInTheDocument();
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

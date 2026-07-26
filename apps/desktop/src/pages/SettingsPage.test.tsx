import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listTableRows } from "@leetbook/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DbProvider } from "../db/DbContext.js";
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

beforeEach(() => {
  vi.clearAllMocks();
});

async function setup() {
  const db = await makeDb();
  render(
    <DbProvider db={db}>
      <SettingsPage />
    </DbProvider>,
  );
  await waitFor(() => expect(screen.getByText(/Local SQLite/)).toBeInTheDocument());
  return db;
}

describe("SettingsPage", () => {
  it("shows database stats", async () => {
    await setup();
    expect(screen.getByText("Local SQLite · 0 problems · 0 reviews")).toBeInTheDocument();
  });

  it("imports the real Notion export and reports the result", async () => {
    const db = await setup();
    const file = new File([FIXTURE], "notion-export.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByLabelText("Notion CSV file"), file);

    await waitFor(() => expect(screen.getByText("47 imported")).toBeInTheDocument());
    expect(screen.getByText(/· 0 skipped/)).toBeInTheDocument();
    // stats refresh after import
    expect(screen.getByText(/47 problems/)).toBeInTheDocument();
    expect(await listTableRows(db)).toHaveLength(47);
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

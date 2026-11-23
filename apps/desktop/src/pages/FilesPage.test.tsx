import type { SqlExecutor } from "@leetbook/core";
import { open } from "@tauri-apps/plugin-dialog";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { DbProvider } from "../db/DbContext.js";
import { importLibraryFile, openLibraryFile } from "../files/library.js";
import { FilesPage } from "./FilesPage.js";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../files/library.js", async (original) => ({
  ...(await original<typeof import("../files/library.js")>()),
  importLibraryFile: vi.fn(),
  openLibraryFile: vi.fn().mockResolvedValue(undefined),
}));
const file = { id: "test", name: "Study notes.pdf", size: 1024, createdAt: "2026-11-22T10:00:00Z" };
const db = { select: vi.fn().mockResolvedValue([file]), execute: vi.fn() } as SqlExecutor;
beforeEach(() => vi.clearAllMocks());
it("opens on double-click and exposes a keyboard-accessible Open action", async () => {
  render(
    <DbProvider db={db}>
      <FilesPage />
    </DbProvider>,
  );
  const title = await screen.findByText(file.name);
  fireEvent.click(title);
  expect(openLibraryFile).not.toHaveBeenCalled();
  fireEvent.doubleClick(title);
  expect(openLibraryFile).toHaveBeenCalledWith(file);
  const button = screen.getByRole("button", { name: `Open ${file.name}` });
  button.focus();
  await userEvent.keyboard("{Enter}");
  expect(openLibraryFile).toHaveBeenCalledTimes(2);
  await userEvent.type(screen.getByRole("searchbox"), "missing");
  expect(screen.getByText("No files match your search.")).toBeInTheDocument();
});
it("imports picked files and refreshes the table", async () => {
  vi.mocked(open).mockResolvedValue(["/tmp/notes.pdf"]);
  render(
    <DbProvider db={db}>
      <FilesPage />
    </DbProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "+ Upload files" }));
  await waitFor(() => expect(importLibraryFile).toHaveBeenCalledWith(db, "/tmp/notes.pdf"));
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Upload files" })).toBeEnabled());
});

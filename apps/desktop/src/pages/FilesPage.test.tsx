import { createFilesRepo, type SqlExecutor } from "@leetbook/core";
import { open } from "@tauri-apps/plugin-dialog";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { DbProvider } from "../db/DbContext.js";
import { importDroppedFiles, importLibrarySources, openLibraryFile } from "../files/library.js";
import { makeDb } from "../test-utils.js";
import { FilesPage } from "./FilesPage.js";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../files/library.js", async (original) => ({
  ...(await original<typeof import("../files/library.js")>()),
  importLibrarySources: vi.fn().mockResolvedValue([]),
  importDroppedFiles: vi.fn().mockResolvedValue([]),
  openLibraryFile: vi.fn().mockResolvedValue(undefined),
}));
beforeEach(() => vi.clearAllMocks());

async function renderPage(seed?: (db: SqlExecutor) => Promise<void>) {
  const db = await makeDb();
  await seed?.(db);
  render(
    <DbProvider db={db}>
      <FilesPage />
    </DbProvider>,
  );
  return db;
}

const addFile = (db: SqlExecutor, id: string, name: string, folderId: string | null = null) =>
  createFilesRepo(db).add({ id, name, size: 1024, createdAt: "2026-11-22T10:00:00Z", folderId });

const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent);

it("opens on double-click and exposes a keyboard-accessible Open action", async () => {
  await renderPage((db) => addFile(db, "test", "Study notes.pdf"));
  const title = await screen.findByText("Study notes.pdf");
  fireEvent.click(title);
  expect(openLibraryFile).not.toHaveBeenCalled();
  fireEvent.doubleClick(title);
  expect(openLibraryFile).toHaveBeenCalledWith(expect.objectContaining({ id: "test" }));
  const button = screen.getByRole("button", { name: "Open Study notes.pdf" });
  button.focus();
  await userEvent.keyboard("{Enter}");
  expect(openLibraryFile).toHaveBeenCalledTimes(2);
  await userEvent.type(screen.getByRole("searchbox"), "missing");
  expect(screen.getByText("No files match your search.")).toBeInTheDocument();
});

it("imports picked files into the open folder", async () => {
  vi.mocked(open).mockResolvedValue(["/tmp/notes.pdf"]);
  const db = await renderPage();
  await userEvent.click(screen.getByRole("button", { name: "+ Upload files" }));
  await waitFor(() =>
    expect(importLibrarySources).toHaveBeenCalledWith(db, ["/tmp/notes.pdf"], null),
  );
  expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ directory: false }));
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Upload files" })).toBeEnabled());
});

it("uploads whole folders from the folder picker", async () => {
  vi.mocked(open).mockResolvedValue(["/Users/me/Graphs"]);
  const db = await renderPage();
  await userEvent.click(screen.getByRole("button", { name: "Upload folder" }));
  await waitFor(() =>
    expect(importLibrarySources).toHaveBeenCalledWith(db, ["/Users/me/Graphs"], null),
  );
  expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ directory: true }));
});

it("creates a folder, opens it and walks back with the breadcrumb", async () => {
  await renderPage((db) => addFile(db, "a", "root.pdf"));
  await screen.findByText("root.pdf");
  await userEvent.click(screen.getByRole("button", { name: "New folder" }));
  await userEvent.type(screen.getByRole("textbox", { name: "New folder name" }), "Graphs{Enter}");

  const folder = await screen.findByText("Graphs");
  expect(names()).toEqual(["Graphs", "root.pdf"]);
  await userEvent.click(screen.getByRole("button", { name: "Open Graphs" }));
  expect(
    await screen.findByText(
      "Upload files or a folder, or drag them into this page to get started.",
    ),
  ).toBeInTheDocument();
  expect(folder).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "All files" }));
  expect(await screen.findByText("root.pdf")).toBeInTheDocument();
});

it("reorders rows by dragging and remembers the order", async () => {
  const db = await renderPage(async (db) => {
    await addFile(db, "a", "a.pdf");
    await addFile(db, "b", "b.pdf");
    await addFile(db, "c", "c.pdf");
  });
  await screen.findByText("a.pdf");
  expect(names()).toEqual(["c.pdf", "b.pdf", "a.pdf"]);

  const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;
  fireEvent.dragStart(rowOf("a.pdf"), { dataTransfer: { setData: vi.fn() } });
  // jsdom rows have no height, so the pointer reads as mid-row: a file lands after c.pdf.
  fireEvent.dragOver(rowOf("c.pdf"));
  fireEvent.drop(rowOf("c.pdf"));

  await waitFor(() => expect(names()).toEqual(["c.pdf", "a.pdf", "b.pdf"]));
  expect((await createFilesRepo(db).list()).map((file) => file.id)).toEqual(["c", "a", "b"]);
});

it("drags a file into a folder", async () => {
  const db = await renderPage(async (db) => {
    await createFilesRepo(db).addFolder({ id: "f", name: "Trees", parentId: null, createdAt: "t" });
    await addFile(db, "a", "a.pdf");
  });
  await screen.findByText("a.pdf");
  fireEvent.dragStart(screen.getByText("a.pdf").closest("tr") as HTMLElement, {
    dataTransfer: { setData: vi.fn() },
  });
  const folderRow = screen.getByText("Trees").closest("tr") as HTMLElement;
  fireEvent.dragOver(folderRow);
  fireEvent.drop(folderRow);

  await waitFor(() => expect(screen.queryByText("a.pdf")).not.toBeInTheDocument());
  expect((await createFilesRepo(db).list())[0]?.folderId).toBe("f");
});

it("reorders with Alt+arrow keys", async () => {
  await renderPage(async (db) => {
    await addFile(db, "a", "a.pdf");
    await addFile(db, "b", "b.pdf");
  });
  await screen.findByText("a.pdf");
  screen.getByRole("button", { name: "Open a.pdf" }).focus();
  await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
  await waitFor(() => expect(names()).toEqual(["a.pdf", "b.pdf"]));
});

it("deletes a file after an inline confirm, and can be cancelled", async () => {
  const db = await renderPage((db) => addFile(db, "a", "a.pdf"));
  await screen.findByText("a.pdf");

  await userEvent.click(screen.getByRole("button", { name: "Delete a.pdf" }));
  expect(screen.getByText("Delete for good?")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByText("Delete for good?")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Delete a.pdf" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete this file" }));
  await waitFor(() => expect(screen.queryByText("a.pdf")).not.toBeInTheDocument());
  expect(await createFilesRepo(db).list()).toEqual([]);
});

it("deletes a folder with its contents", async () => {
  const db = await renderPage(async (db) => {
    await createFilesRepo(db).addFolder({ id: "f", name: "Trees", parentId: null, createdAt: "t" });
    await addFile(db, "a", "inside.pdf", "f");
  });
  await screen.findByText("Trees");
  await userEvent.click(screen.getByRole("button", { name: "Delete Trees" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Delete this folder and everything in it" }),
  );
  await waitFor(() => expect(screen.queryByText("Trees")).not.toBeInTheDocument());
  expect(await createFilesRepo(db).listFolders()).toEqual([]);
  expect(await createFilesRepo(db).list()).toEqual([]);
});

it("saves a dropped screenshot thumbnail (a browser File) into the open folder", async () => {
  const db = await renderPage();
  const screenshot = new File(["png"], "Screenshot.png", { type: "image/png" });
  fireEvent.drop(screen.getByRole("region", { name: "Files & Notes" }), {
    dataTransfer: { files: [screenshot], types: ["Files"] },
  });
  await waitFor(() => expect(importDroppedFiles).toHaveBeenCalledWith(db, [screenshot], null));
});

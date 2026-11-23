import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, expect, it, vi } from "vitest";
import { imageDataUrl, nativeImage } from "../../files/noteImages.js";
import { NoteEditor } from "./NoteEditor.js";

vi.mock("../../files/noteImages.js", () => ({
  imageDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,aGVsbG8="),
  nativeImage: vi.fn(),
}));
const { nativeDrop } = vi.hoisted(() => ({
  nativeDrop: {
    current: undefined as undefined | ((paths: string[], point: { x: number; y: number }) => void),
  },
}));
vi.mock("../../files/useFileDrop.js", () => ({
  useFileDrop: (_target: unknown, onDrop: typeof nativeDrop.current) => {
    nativeDrop.current = onDrop;
    return false;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
async function setup(initial: string | null = null) {
  let instance: Editor | undefined;
  const onChange = vi.fn();
  render(
    <NoteEditor
      initialContentJson={initial}
      onChange={onChange}
      onReady={(editor) => {
        instance = editor;
      }}
    />,
  );
  await waitFor(() => expect(instance).toBeDefined());
  return { editor: instance as Editor, onChange };
}
it("pastes images inline, saves them with text, and restores after reopening", async () => {
  const { editor, onChange } = await setup();
  editor.commands.insertContent("Remember the invariant.");
  fireEvent.paste(screen.getByRole("textbox"), {
    clipboardData: { files: [new File(["image"], "Screenshot.png", { type: "image/png" })] },
  });
  await screen.findByAltText("Screenshot.png");
  const saved = onChange.mock.calls.at(-1)?.[0] as string;
  expect(saved).toContain("data:image/png;base64,");
  expect(saved).toContain("Remember the invariant.");
  expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
  cleanup();
  await setup(saved);
  expect(screen.getByAltText("Screenshot.png")).toBeInTheDocument();
  expect(screen.getByText("Remember the invariant.")).toBeInTheDocument();
});
it("supports browser drops and leaves the image undoable", async () => {
  const { editor } = await setup();
  vi.spyOn(editor.view, "posAtCoords").mockReturnValue({ pos: 1, inside: 0 });
  fireEvent.drop(screen.getByRole("textbox"), {
    dataTransfer: { files: [new File(["image"], "Diagram.png", { type: "image/png" })] },
    clientX: 20,
    clientY: 30,
  });
  await screen.findByAltText("Diagram.png");
  editor.commands.undo();
  await waitFor(() => expect(screen.queryByAltText("Diagram.png")).not.toBeInTheDocument());
});
it("inserts native Tauri drops at their document position", async () => {
  const { editor } = await setup();
  vi.mocked(nativeImage).mockResolvedValue(new File(["img"], "Native.png", { type: "image/png" }));
  vi.spyOn(editor.view, "posAtCoords").mockReturnValue({ pos: 1, inside: 0 });
  nativeDrop.current?.(["/tmp/Native.png"], { x: 40, y: 80 });
  await screen.findByAltText("Native.png");
  expect(nativeImage).toHaveBeenCalledWith("/tmp/Native.png");
});
it("shows a failed upload without replacing existing notes", async () => {
  const { editor } = await setup();
  editor.commands.insertContent("Keep this text.");
  vi.mocked(imageDataUrl).mockRejectedValueOnce(new Error("Images must be 10 MB or smaller."));
  fireEvent.change(screen.getByLabelText("Upload note images"), {
    target: { files: [new File(["x"], "large.png", { type: "image/png" })] },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("10 MB or smaller");
  expect(screen.getByText("Keep this text.")).toBeInTheDocument();
});

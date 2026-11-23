import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useFileDrop } from "./useFileDrop.js";

const { subscribe } = vi.hoisted(() => ({ subscribe: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: subscribe }),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it("maps Retina drops into the target, ignores outside drops, and cleans up", async () => {
  type Payload = { type: "drop"; position: { x: number; y: number }; paths: string[] };
  let receive: ((event: { payload: Payload }) => void) | undefined;
  const stop = vi.fn();
  subscribe.mockImplementation((callback) => {
    receive = callback;
    return Promise.resolve(stop);
  });
  vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(2);
  const element = document.createElement("div");
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 100,
    right: 400,
    bottom: 500,
  } as DOMRect);
  const target = { current: element };
  const drop = vi.fn();
  const { unmount } = renderHook(() => useFileDrop(target, drop, vi.fn()));
  await waitFor(() => expect(receive).toBeDefined());
  act(() =>
    receive?.({
      payload: { type: "drop", position: { x: 300, y: 400 }, paths: ["/tmp/notes.pdf"] },
    }),
  );
  expect(drop).toHaveBeenCalledWith(["/tmp/notes.pdf"], { x: 150, y: 200 });
  act(() =>
    receive?.({
      payload: { type: "drop", position: { x: 10, y: 10 }, paths: ["/tmp/outside.pdf"] },
    }),
  );
  expect(drop).toHaveBeenCalledTimes(1);
  unmount();
  expect(stop).toHaveBeenCalledOnce();
});

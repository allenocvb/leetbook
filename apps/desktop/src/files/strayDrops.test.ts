import { expect, it } from "vitest";
import { preventStrayFileDrops } from "./strayDrops.js";

function dragEvent(type: string, types: string[]) {
  const event = new Event(type, { cancelable: true }) as DragEvent;
  Object.defineProperty(event, "dataTransfer", { value: { types } });
  return event;
}

it("stops file drops from navigating the webview, and leaves other drags alone", () => {
  const stop = preventStrayFileDrops();
  const fileDrop = dragEvent("drop", ["Files"]);
  window.dispatchEvent(fileDrop);
  expect(fileDrop.defaultPrevented).toBe(true);

  const textDrop = dragEvent("drop", ["text/plain"]);
  window.dispatchEvent(textDrop);
  expect(textDrop.defaultPrevented).toBe(false);

  stop();
  const after = dragEvent("dragover", ["Files"]);
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});

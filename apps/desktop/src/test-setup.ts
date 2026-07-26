import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest runs without injected globals, so Testing Library's automatic
// cleanup doesn't hook in — do it explicitly.
afterEach(() => {
  cleanup();
});

// jsdom lacks layout APIs that ProseMirror (TipTap) touches on mount.
function zeroRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

if (typeof Range !== "undefined") {
  Range.prototype.getBoundingClientRect = zeroRect;
  Range.prototype.getClientRects = () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: [][Symbol.iterator],
    }) as unknown as DOMRectList;
}
if (typeof document !== "undefined" && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

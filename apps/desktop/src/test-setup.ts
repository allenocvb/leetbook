import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest runs without injected globals, so Testing Library's automatic
// cleanup doesn't hook in — do it explicitly.
afterEach(() => {
  cleanup();
});

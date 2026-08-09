import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    /*
     * Processes, not worker threads.
     *
     * Most of this suite opens an in-memory database through `node:sqlite`. Two separate
     * things went wrong under the default threads pool, and only one was obvious:
     *
     * 1. Test databases were never closed. Native handles are not garbage collected, so they
     *    piled up until the run stopped making progress. Fixed in `test-utils.ts`, which now
     *    closes every database after each test — that is the real bug, and it was masked by
     *    switching pools rather than found.
     * 2. Even with the leak fixed, threads still hangs. `node:sqlite` is experimental and
     *    does not survive repeated teardown in a worker thread.
     *
     * The failure mode is what makes this worth writing down: no error, no output, and every
     * file passing in isolation. Revisit when node:sqlite is stable; until then this is
     * load-bearing, not a preference.
     */
    pool: "forks",
  },
});

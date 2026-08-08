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
     * Most of this suite opens an in-memory database through `node:sqlite`, which is still
     * experimental and does not survive being torn down and recreated across many worker
     * threads — past roughly two dozen files the run stops making progress and hangs with no
     * failure and no output. Every file passes in isolation, which is what makes it so
     * misleading. Forks give each file a clean process and the whole suite completes.
     *
     * Revisit when node:sqlite is stable; until then this is load-bearing, not a preference.
     */
    pool: "forks",
  },
});

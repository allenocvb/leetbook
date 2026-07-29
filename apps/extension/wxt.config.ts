import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "LeetBook Capture",
    description:
      "Captures Accepted LeetCode and NeetCode submissions and sends them to the LeetBook desktop app.",
    permissions: ["storage", "alarms"],
    /*
     * leetcode.com is required even while the user is on neetcode.io: a NeetCode capture is
     * identified by looking the problem up on LeetCode, and the background worker needs the
     * host permission to make that cross-origin call.
     */
    host_permissions: ["*://leetcode.com/*", "*://neetcode.io/*", "http://127.0.0.1/*"],
  },
});

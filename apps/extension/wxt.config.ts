import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "LeetBook Capture",
    description:
      "Captures Accepted LeetCode submissions and sends them to the LeetBook desktop app.",
    permissions: ["storage"],
    host_permissions: ["*://leetcode.com/*", "http://127.0.0.1/*"],
  },
});

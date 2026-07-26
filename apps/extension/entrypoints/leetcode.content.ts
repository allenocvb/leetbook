export default defineContentScript({
  matches: ["*://leetcode.com/*"],
  main() {
    // v1: detect Accepted submissions, scrape metadata via the capture adapter,
    // show the 0–5 recall toast. All scraping stays isolated in one adapter module.
    console.log("[LeetBook] content script loaded");
  },
});

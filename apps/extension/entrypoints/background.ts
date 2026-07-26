export default defineBackground(() => {
  // v1: relay captured submissions from the content script to the desktop app
  // on 127.0.0.1, queueing in extension storage when the app is closed.
  console.log("[LeetBook] background ready");
});

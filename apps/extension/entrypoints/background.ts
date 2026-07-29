import { fetchProblemMeta } from "../capture/adapter.js";
import { DEFAULT_PORT, type PairingSettings, sendQueueStatus } from "../capture/client.js";
import { deliverCapture, flushCaptureQueue, type QueueStatusMessage } from "../capture/delivery.js";
import { isProblemMetaRequest } from "../capture/metaRelay.js";
import type { CapturePayload } from "../capture/payload.js";
import { createQueue, type KvStorage } from "../capture/queue.js";

const storage: KvStorage = {
  async get(key) {
    const result = await browser.storage.local.get(key);
    return result[key];
  },
  async set(key, value) {
    await browser.storage.local.set({ [key]: value });
  },
};

const queue = createQueue(storage);
let deliveryChain = Promise.resolve();

async function pairingSettings(): Promise<PairingSettings> {
  const stored = (await storage.get("leetbook-pairing")) as Partial<PairingSettings> | undefined;
  return { port: stored?.port ?? DEFAULT_PORT, token: stored?.token ?? "" };
}

async function deliver(payload: CapturePayload) {
  const settings = await pairingSettings();
  const result = await deliverCapture(queue, settings, payload);
  await sendQueueStatus(result.queued, settings);
  return result;
}

async function flushQueue(): Promise<void> {
  const settings = await pairingSettings();
  const result = await flushCaptureQueue(queue, settings);
  await sendQueueStatus(result.remaining, settings);
  if (result.sent > 0) await notifyQueueStatus(result);
}

async function notifyQueueStatus(result: { sent: number; remaining: number }): Promise<void> {
  const message: QueueStatusMessage = { type: "leetbook-queue-status", ...result };
  // Both practice sites, or a NeetCode toast never hears that its queued capture went out.
  const tabs = await browser.tabs.query({
    url: ["*://leetcode.com/*", "*://neetcode.io/*"],
  });
  await Promise.allSettled(
    tabs.flatMap((tab) =>
      tab.id === undefined ? [] : [browser.tabs.sendMessage(tab.id, message)],
    ),
  );
}

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = deliveryChain.then(operation);
  deliveryChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) => {
    const typed = message as { type?: string; payload?: CapturePayload };
    if (typed?.type === "leetbook-capture" && typed.payload) {
      const payload = typed.payload;
      return serialized(() => deliver(payload));
    }
    /*
     * A NeetCode content script cannot call leetcode.com itself — that is cross-origin and
     * LeetCode sends no permissive CORS header. The worker holds the host permission, so the
     * lookup happens here and the result is passed back.
     *
     * Not serialized: this is a read with no shared state, and queueing it behind capture
     * delivery would stall the toast on an unrelated retry.
     */
    if (isProblemMetaRequest(message)) {
      return fetchProblemMeta(message.slug);
    }
  });

  // retry queued captures every minute in case the app comes back
  browser.alarms.create("leetbook-flush", { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "leetbook-flush") void serialized(flushQueue);
  });

  void serialized(flushQueue);
});

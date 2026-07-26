import { DEFAULT_PORT, type PairingSettings } from "../capture/client.js";
import { deliverCapture, flushCaptureQueue, type QueueStatusMessage } from "../capture/delivery.js";
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
  return deliverCapture(queue, settings, payload);
}

async function flushQueue(): Promise<void> {
  const settings = await pairingSettings();
  const result = await flushCaptureQueue(queue, settings);
  if (result.sent > 0) await notifyQueueStatus(result);
}

async function notifyQueueStatus(result: { sent: number; remaining: number }): Promise<void> {
  const message: QueueStatusMessage = { type: "leetbook-queue-status", ...result };
  const tabs = await browser.tabs.query({ url: "*://leetcode.com/*" });
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
  });

  // retry queued captures every minute in case the app comes back
  browser.alarms.create("leetbook-flush", { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "leetbook-flush") void serialized(flushQueue);
  });

  void serialized(flushQueue);
});

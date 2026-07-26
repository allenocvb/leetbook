import { DEFAULT_PORT, type PairingSettings, sendCapture } from "../capture/client.js";
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

async function pairingSettings(): Promise<PairingSettings> {
  const stored = (await storage.get("leetbook-pairing")) as Partial<PairingSettings> | undefined;
  return { port: stored?.port ?? DEFAULT_PORT, token: stored?.token ?? "" };
}

async function deliver(payload: CapturePayload): Promise<void> {
  const settings = await pairingSettings();
  // drain older captures first so reviews stay in order
  await queue.flush((queued) => sendCapture(queued, settings));
  if (!(await sendCapture(payload, settings))) {
    await queue.enqueue(payload);
  }
}

async function flushQueue(): Promise<void> {
  const settings = await pairingSettings();
  await queue.flush((queued) => sendCapture(queued, settings));
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) => {
    const typed = message as { type?: string; payload?: CapturePayload };
    if (typed?.type === "leetbook-capture" && typed.payload) {
      void deliver(typed.payload);
    }
  });

  // retry queued captures every minute in case the app comes back
  browser.alarms.create("leetbook-flush", { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "leetbook-flush") void flushQueue();
  });

  void flushQueue();
});

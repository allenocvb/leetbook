import type { CapturePayload } from "./payload.js";

/** Minimal async key-value storage (backed by browser.storage.local in production). */
export interface KvStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

const QUEUE_KEY = "leetbook-capture-queue";

export interface CaptureQueue {
  enqueue(payload: CapturePayload): Promise<number>;
  size(): Promise<number>;
  /** Sends queued payloads oldest-first; stops at the first failure. */
  flush(send: (payload: CapturePayload) => Promise<boolean>): Promise<{
    sent: number;
    remaining: number;
  }>;
}

/** Offline queue: captures made while the desktop app is closed wait here. */
export function createQueue(storage: KvStorage): CaptureQueue {
  async function read(): Promise<CapturePayload[]> {
    const raw = await storage.get(QUEUE_KEY);
    return Array.isArray(raw) ? (raw as CapturePayload[]) : [];
  }

  return {
    async enqueue(payload) {
      const queue = await read();
      queue.push(payload);
      await storage.set(QUEUE_KEY, queue);
      return queue.length;
    },

    async size() {
      return (await read()).length;
    },

    async flush(send) {
      const queue = await read();
      let sent = 0;
      while (sent < queue.length) {
        const next = queue[sent] as CapturePayload;
        if (!(await send(next))) break;
        sent++;
      }
      const remaining = queue.slice(sent);
      await storage.set(QUEUE_KEY, remaining);
      return { sent, remaining: remaining.length };
    },
  };
}

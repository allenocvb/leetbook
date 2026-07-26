import { type PairingSettings, sendCapture } from "./client.js";
import type { CapturePayload } from "./payload.js";
import type { CaptureQueue } from "./queue.js";

export type CaptureDeliveryResult =
  | { status: "delivered"; queued: 0 }
  | { status: "queued"; queued: number };

export interface QueueFlushResult {
  sent: number;
  remaining: number;
}

export interface QueueStatusMessage extends QueueFlushResult {
  type: "leetbook-queue-status";
}

type CaptureSender = (payload: CapturePayload, settings: PairingSettings) => Promise<boolean>;

/** Flushes older work first, then delivers or safely queues the new capture. */
export async function deliverCapture(
  queue: CaptureQueue,
  settings: PairingSettings,
  payload: CapturePayload,
  send: CaptureSender = sendCapture,
): Promise<CaptureDeliveryResult> {
  const flushed = await queue.flush((queued) => send(queued, settings));
  if (flushed.remaining > 0) {
    return { status: "queued", queued: await queue.enqueue(payload) };
  }
  if (await send(payload, settings)) return { status: "delivered", queued: 0 };
  return { status: "queued", queued: await queue.enqueue(payload) };
}

export function flushCaptureQueue(
  queue: CaptureQueue,
  settings: PairingSettings,
  send: CaptureSender = sendCapture,
): Promise<QueueFlushResult> {
  return queue.flush((queued) => send(queued, settings));
}

export function isCaptureDeliveryResult(value: unknown): value is CaptureDeliveryResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<CaptureDeliveryResult>;
  return (
    (result.status === "delivered" && result.queued === 0) ||
    (result.status === "queued" &&
      typeof result.queued === "number" &&
      Number.isInteger(result.queued) &&
      result.queued > 0)
  );
}

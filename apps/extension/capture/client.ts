import type { CapturePayload } from "./payload.js";

export interface PairingSettings {
  port: number;
  token: string;
}

export const DEFAULT_PORT = 7749;

function base(settings: PairingSettings): string {
  return `http://127.0.0.1:${settings.port}`;
}

/** POSTs a capture to the desktop app. False on any failure (app closed, bad token…). */
export async function sendCapture(
  payload: CapturePayload,
  settings: PairingSettings,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchFn(`${base(settings)}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-leetbook-token": settings.token,
      },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Reports the extension's real offline queue size to the paired desktop app. */
export async function sendQueueStatus(
  queued: number,
  settings: PairingSettings,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchFn(`${base(settings)}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-leetbook-token": settings.token,
      },
      body: JSON.stringify({ queued }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** True when the desktop app is running and reachable. */
export async function pingApp(
  settings: PairingSettings,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchFn(`${base(settings)}/ping`);
    return response.ok;
  } catch {
    return false;
  }
}

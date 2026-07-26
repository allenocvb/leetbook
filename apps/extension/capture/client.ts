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

export interface PairRequestStarted {
  requestId: string;
  code: string;
  expiresInMs: number;
}

export type PairStatus = "pending" | "approved" | "denied" | "expired";

/**
 * Asks the desktop app to pair. No token is needed — that is the point: the user approves
 * in the app, which is where the trust decision belongs, instead of copying a secret across
 * two windows. The returned code is shown here and in the app so the user can see the two
 * match before approving.
 */
export async function requestPairing(
  port: number,
  fetchFn: typeof fetch = fetch,
): Promise<PairRequestStarted | null> {
  try {
    const response = await fetchFn(`http://127.0.0.1:${port}/pair/request`, { method: "POST" });
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<PairRequestStarted> & { ok?: boolean };
    if (!body.requestId || !body.code) return null;
    return {
      requestId: body.requestId,
      code: body.code,
      expiresInMs: body.expiresInMs ?? 120_000,
    };
  } catch {
    return null;
  }
}

/** Polls the pending request. Returns the token only once the user has approved it. */
export async function checkPairing(
  port: number,
  requestId: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ status: PairStatus; token?: string }> {
  try {
    const response = await fetchFn(
      `http://127.0.0.1:${port}/pair/status?id=${encodeURIComponent(requestId)}`,
    );
    if (!response.ok) return { status: "expired" };
    const body = (await response.json()) as { status?: PairStatus; token?: string };
    return { status: body.status ?? "expired", token: body.token };
  } catch {
    // The app closing mid-handshake is indistinguishable from a denial to the caller,
    // but treating it as pending lets the poll keep trying until it times out.
    return { status: "pending" };
  }
}

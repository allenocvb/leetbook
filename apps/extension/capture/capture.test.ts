import { describe, expect, it, vi } from "vitest";
import { pingApp, sendCapture } from "./client.js";
import { deliverCapture, isCaptureDeliveryResult } from "./delivery.js";
import type { CapturePayload } from "./payload.js";
import { createQueue, type KvStorage } from "./queue.js";
import { showCaptureToast } from "./toast.js";

const SETTINGS = { port: 7749, token: "7F2K91QD" };

function payload(slug: string): CapturePayload {
  return {
    version: 1,
    slug,
    title: slug,
    difficulty: "easy",
    tags: [],
    score: 4,
    runtimeMs: null,
    memoryMb: null,
    language: null,
    codeSnapshot: null,
    capturedAt: "2026-07-25T12:00:00.000Z",
  };
}

describe("sendCapture", () => {
  it("POSTs the payload with the pairing token", async () => {
    const fetchFn = vi.fn(async () => new Response('{"ok":true}'));
    expect(
      await sendCapture(payload("two-sum"), SETTINGS, fetchFn as unknown as typeof fetch),
    ).toBe(true);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:7749/capture");
    expect((init.headers as Record<string, string>)["x-leetbook-token"]).toBe("7F2K91QD");
    expect(JSON.parse(init.body as string).slug).toBe("two-sum");
  });

  it("returns false on rejection and non-2xx", async () => {
    const rejects = vi.fn(async () => {
      throw new Error("app closed");
    });
    expect(await sendCapture(payload("x"), SETTINGS, rejects as unknown as typeof fetch)).toBe(
      false,
    );

    const unauthorized = vi.fn(async () => new Response("no", { status: 401 }));
    expect(await sendCapture(payload("x"), SETTINGS, unauthorized as unknown as typeof fetch)).toBe(
      false,
    );
  });
});

describe("pingApp", () => {
  it("is true when /ping responds ok", async () => {
    const fetchFn = vi.fn(async (_url: string) => new Response('{"ok":true}'));
    expect(await pingApp(SETTINGS, fetchFn as unknown as typeof fetch)).toBe(true);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://127.0.0.1:7749/ping");
  });

  it("is false when unreachable", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("nope");
    });
    expect(await pingApp(SETTINGS, fetchFn as unknown as typeof fetch)).toBe(false);
  });
});

describe("createQueue", () => {
  function memoryStorage(): KvStorage {
    const data = new Map<string, unknown>();
    return {
      get: async (key) => data.get(key),
      set: async (key, value) => void data.set(key, value),
    };
  }

  it("enqueues and reports size", async () => {
    const queue = createQueue(memoryStorage());
    expect(await queue.enqueue(payload("a"))).toBe(1);
    expect(await queue.enqueue(payload("b"))).toBe(2);
    expect(await queue.size()).toBe(2);
  });

  it("flush drains oldest-first and stops at the first failure", async () => {
    const queue = createQueue(memoryStorage());
    await queue.enqueue(payload("a"));
    await queue.enqueue(payload("b"));
    await queue.enqueue(payload("c"));

    const sent: string[] = [];
    const send = vi.fn(async (item: CapturePayload) => {
      if (item.slug === "c") return false;
      sent.push(item.slug);
      return true;
    });

    expect(await queue.flush(send)).toEqual({ sent: 2, remaining: 1 });
    expect(sent).toEqual(["a", "b"]);
    expect(await queue.size()).toBe(1);

    // app comes back → the rest drains
    const sendAll = vi.fn(async () => true);
    expect(await queue.flush(sendAll)).toEqual({ sent: 1, remaining: 0 });
    expect(await queue.size()).toBe(0);
  });
});

describe("deliverCapture", () => {
  it("delivers after draining older captures in order", async () => {
    const queue = createQueue(memoryStorage());
    await queue.enqueue(payload("older"));
    const sent: string[] = [];
    const send = vi.fn(async (item: CapturePayload) => {
      sent.push(item.slug);
      return true;
    });

    expect(await deliverCapture(queue, SETTINGS, payload("new"), send)).toEqual({
      status: "delivered",
      queued: 0,
    });
    expect(sent).toEqual(["older", "new"]);
  });

  it("queues behind older work when the desktop app stays offline", async () => {
    const queue = createQueue(memoryStorage());
    await queue.enqueue(payload("older"));
    const send = vi.fn(async () => false);

    expect(await deliverCapture(queue, SETTINGS, payload("new"), send)).toEqual({
      status: "queued",
      queued: 2,
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("validates background delivery responses", () => {
    expect(isCaptureDeliveryResult({ status: "delivered", queued: 0 })).toBe(true);
    expect(isCaptureDeliveryResult({ status: "queued", queued: 3 })).toBe(true);
    expect(isCaptureDeliveryResult({ status: "queued", queued: 0 })).toBe(false);
    expect(isCaptureDeliveryResult(undefined)).toBe(false);
  });
});

/** Queries inside the toast's shadow root, failing loudly if absent. */
function inShadow(host: HTMLElement, selector: string): HTMLButtonElement {
  const element = host.shadowRoot?.querySelector<HTMLButtonElement>(selector);
  if (!element) throw new Error(`toast is missing "${selector}"`);
  return element;
}

describe("showCaptureToast", () => {
  const content = {
    title: "Two Sum",
    difficulty: "easy" as const,
    runtimeMs: 61,
    memoryMb: 18.4,
    codeSaved: true,
  };

  it("renders final metadata and delivers a chosen score", async () => {
    const onRate = vi.fn(async () => ({ status: "delivered", queued: 0 }) as const);
    const toast = showCaptureToast(document, content, { onRate });

    const root = toast.host.shadowRoot;
    expect(root?.textContent).toContain("Two Sum");
    expect(root?.textContent).toContain("Easy · 61 ms · 18.4 MB · code saved");

    const buttons = root?.querySelectorAll(".scores button") ?? [];
    expect(buttons).toHaveLength(6);
    (buttons[3] as HTMLButtonElement).click();
    await vi.waitFor(() => expect(onRate).toHaveBeenCalledWith(3));
    await vi.waitFor(() => expect(document.getElementById("leetbook-capture-toast")).toBeNull());
  });

  it("shows the real queued count and later flush feedback", async () => {
    const onRate = vi.fn(async () => ({ status: "queued", queued: 2 }) as const);
    const toast = showCaptureToast(document, content, { onRate });
    inShadow(toast.host, '.score[aria-label="Score 5"]').click();

    await vi.waitFor(() =>
      expect(toast.host.shadowRoot?.textContent).toContain("Queued — 2 waiting"),
    );
    expect(toast.host.shadowRoot?.textContent).toContain("Desktop app offline");

    toast.setFlushResult({ sent: 2, remaining: 0 });
    expect(toast.host.shadowRoot?.textContent).toContain("Sent to LeetBook");
    expect(toast.host.shadowRoot?.textContent).toContain("Queue is clear");
  });

  it("skip and dismiss both schedule as Good before closing", () => {
    const onSkip = vi.fn(async () => ({ status: "delivered", queued: 0 }) as const);
    const skipped = showCaptureToast(document, content, { onRate: onSkip });
    inShadow(skipped.host, ".skip").click();
    expect(onSkip).toHaveBeenCalledWith(4);
    expect(document.getElementById("leetbook-capture-toast")).toBeNull();

    const onDismiss = vi.fn(async () => ({ status: "delivered", queued: 0 }) as const);
    const dismissed = showCaptureToast(document, content, { onRate: onDismiss });
    inShadow(dismissed.host, ".dismiss").click();
    expect(onDismiss).toHaveBeenCalledWith(4);
    expect(document.getElementById("leetbook-capture-toast")).toBeNull();
  });

  it("uses the final dark tokens when the host page is dark", () => {
    document.documentElement.dataset.theme = "dark";
    const toast = showCaptureToast(document, content, {
      onRate: async () => ({ status: "delivered", queued: 0 }),
    });
    expect(toast.host.getAttribute("data-theme")).toBe("dark");
    document.documentElement.removeAttribute("data-theme");
  });
});

function memoryStorage(): KvStorage {
  const data = new Map<string, unknown>();
  return {
    get: async (key) => data.get(key),
    set: async (key, value) => void data.set(key, value),
  };
}

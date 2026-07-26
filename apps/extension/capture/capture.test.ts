import { describe, expect, it, vi } from "vitest";
import { pingApp, sendCapture } from "./client.js";
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

/** Queries inside the toast's shadow root, failing loudly if absent. */
function inShadow(host: HTMLElement, selector: string): HTMLButtonElement {
  const element = host.shadowRoot?.querySelector<HTMLButtonElement>(selector);
  if (!element) throw new Error(`toast is missing "${selector}"`);
  return element;
}

describe("showCaptureToast", () => {
  it("renders title and meta, rating removes the toast and reports the score", () => {
    const onRate = vi.fn();
    const host = showCaptureToast(
      document,
      { title: "Two Sum", meta: "Easy · 61 ms · code saved" },
      { onRate, onSkip: vi.fn() },
    );

    const root = host.shadowRoot;
    expect(root?.textContent).toContain("Two Sum");
    expect(root?.textContent).toContain("Easy · 61 ms · code saved");

    const buttons = root?.querySelectorAll(".scores button") ?? [];
    expect(buttons).toHaveLength(6);
    (buttons[3] as HTMLButtonElement).click();
    expect(onRate).toHaveBeenCalledWith(3);
    expect(document.getElementById("leetbook-capture-toast")).toBeNull();
  });

  it("skip removes the toast without rating", () => {
    const onRate = vi.fn();
    const onSkip = vi.fn();
    const host = showCaptureToast(document, { title: "X", meta: "" }, { onRate, onSkip });
    inShadow(host, ".skip").click();
    expect(onSkip).toHaveBeenCalled();
    expect(onRate).not.toHaveBeenCalled();
    expect(document.getElementById("leetbook-capture-toast")).toBeNull();
  });
});

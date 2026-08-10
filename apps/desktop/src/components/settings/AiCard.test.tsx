import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ApiKeyStore } from "../../ai/apiKeyStore.js";
import { AiCard } from "./AiCard.js";

function fakeStore(initial: string | null = null, available = true): ApiKeyStore {
  let key = initial;
  return {
    available,
    load: vi.fn(async () => key),
    save: vi.fn(async (next: string) => {
      key = next.trim() === "" ? null : next.trim();
    }),
    clear: vi.fn(async () => {
      key = null;
    }),
  };
}

describe("AiCard", () => {
  it("is off until a key is set, so the app ships contacting nobody", async () => {
    render(<AiCard store={fakeStore(null)} />);
    await waitFor(() => expect(screen.getByText("Off — no key set")).toBeInTheDocument());
  });

  it("says plainly that notes leave the machine", async () => {
    render(<AiCard store={fakeStore(null)} />);
    // The rest of the product promises local-first; this is where that stops being literal.
    expect(screen.getByText(/sends that topic's notes to Anthropic/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing is sent while you\s+review/)).toBeInTheDocument();
  });

  it("shows only a masked hint of a stored key", async () => {
    render(<AiCard store={fakeStore("sk-ant-api03-abcdefghijklmnop")} />);

    await waitFor(() => expect(screen.getByText("On — a key is set")).toBeInTheDocument());
    // A full key on screen is one screenshot away from being leaked.
    expect(screen.queryByText(/api03/)).not.toBeInTheDocument();
    expect(screen.getByText("sk-ant…mnop")).toBeInTheDocument();
  });

  it("saves a key and flips to on", async () => {
    const store = fakeStore(null);
    render(<AiCard store={store} />);

    await userEvent.type(screen.getByLabelText("Anthropic API key"), "sk-ant-secret-value");
    await userEvent.click(screen.getByRole("button", { name: "Save key" }));

    await waitFor(() => expect(screen.getByText("On — a key is set")).toBeInTheDocument());
    expect(store.save).toHaveBeenCalledWith("sk-ant-secret-value");
    // The field must not keep holding the credential after saving.
    expect(screen.getByLabelText("Anthropic API key")).toHaveValue("");
  });

  it("removes a key and turns itself back off", async () => {
    const store = fakeStore("sk-ant-existing-key-value");
    render(<AiCard store={store} />);

    await waitFor(() => expect(screen.getByText("On — a key is set")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Remove key" }));

    await waitFor(() => expect(screen.getByText("Off — no key set")).toBeInTheDocument());
    expect(store.clear).toHaveBeenCalled();
  });

  it("offers no field at all when there is no keychain", async () => {
    render(<AiCard store={fakeStore(null, false)} />);

    await waitFor(() =>
      expect(screen.getByText(/Unavailable outside the desktop app/)).toBeInTheDocument(),
    );
    // Better to offer nothing than a field that silently cannot persist.
    expect(screen.queryByLabelText("Anthropic API key")).not.toBeInTheDocument();
  });
});

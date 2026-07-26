import { DEFAULT_PORT, type PairingSettings, pingApp } from "../../capture/client.js";

const form = document.getElementById("pairing-form") as HTMLFormElement;
const tokenInput = document.getElementById("token") as HTMLInputElement;
const portInput = document.getElementById("port") as HTMLInputElement;
const status = document.getElementById("status") as HTMLParagraphElement;

async function load(): Promise<void> {
  const stored = await browser.storage.local.get("leetbook-pairing");
  const pairing = stored["leetbook-pairing"] as Partial<PairingSettings> | undefined;
  tokenInput.value = pairing?.token ?? "";
  portInput.value = String(pairing?.port ?? DEFAULT_PORT);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void (async () => {
    const settings: PairingSettings = {
      token: tokenInput.value.trim(),
      port: Number.parseInt(portInput.value, 10) || DEFAULT_PORT,
    };
    await browser.storage.local.set({ "leetbook-pairing": settings });
    status.textContent = "Saved. Testing connection…";
    status.textContent = (await pingApp(settings))
      ? "Saved — LeetBook app is reachable. You're paired."
      : "Saved — but the LeetBook app isn't reachable. Is it running?";
  })();
});

void load();

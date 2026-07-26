import {
  checkPairing,
  DEFAULT_PORT,
  type PairingSettings,
  pingApp,
  requestPairing,
} from "../../capture/client.js";

const connect = document.getElementById("connect") as HTMLButtonElement;
const code = document.getElementById("code") as HTMLParagraphElement;
const status = document.getElementById("status") as HTMLParagraphElement;

const POLL_INTERVAL_MS = 1_000;

function say(message: string, tone: "" | "paired" | "failed" = "") {
  status.textContent = message;
  status.className = tone;
}

async function stored(): Promise<Partial<PairingSettings>> {
  const saved = await browser.storage.local.get("leetbook-pairing");
  return (saved["leetbook-pairing"] as Partial<PairingSettings> | undefined) ?? {};
}

async function showCurrentState(): Promise<void> {
  const pairing = await stored();
  if (!pairing.token) {
    say("Not connected yet.");
    return;
  }
  const reachable = await pingApp({ token: pairing.token, port: pairing.port ?? DEFAULT_PORT });
  say(
    reachable ? "Connected — LeetBook is running." : "Paired, but LeetBook isn't running.",
    reachable ? "paired" : "",
  );
}

/** Polls until the user answers the prompt in the app, or the request expires. */
async function waitForApproval(port: number, requestId: string, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    const { status: state, token } = await checkPairing(port, requestId);

    if (state === "approved" && token) {
      await browser.storage.local.set({ "leetbook-pairing": { token, port } });
      code.textContent = "";
      say("Connected — captures will go straight to LeetBook.", "paired");
      return;
    }
    if (state === "denied") {
      code.textContent = "";
      say("LeetBook declined the request.", "failed");
      return;
    }
    if (state === "expired") break;

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  code.textContent = "";
  say("The request expired. Try connecting again.", "failed");
}

connect.addEventListener("click", () => {
  void (async () => {
    connect.disabled = true;
    code.textContent = "";
    say("Asking LeetBook…");

    const port = (await stored()).port ?? DEFAULT_PORT;
    const started = await requestPairing(port);
    if (!started) {
      say("Couldn't reach LeetBook. Is the app running?", "failed");
      connect.disabled = false;
      return;
    }

    code.textContent = started.code;
    say("Approve this code in LeetBook to finish connecting.");
    await waitForApproval(port, started.requestId, Date.now() + started.expiresInMs);
    connect.disabled = false;
  })();
});

void showCurrentState();

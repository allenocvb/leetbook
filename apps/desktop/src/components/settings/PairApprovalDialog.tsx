import { useState } from "react";
import type { PairPrompt } from "../../capture/useCaptureListener.js";
import { ProblemDialog } from "../problem/ProblemDialog.js";
import { Button } from "../ui/Button.js";
import "./PairApprovalDialog.css";

export interface PairApprovalDialogProps {
  prompt: PairPrompt;
  onResolve: (approve: boolean) => Promise<void>;
}

/**
 * Shown when a browser extension asks to pair. This replaces copying a token between two
 * windows: the trust decision happens here, in the app the user already trusts. The code is
 * for recognition, not secrecy — it lets the user confirm this is the request they just made
 * rather than something else that reached the localhost listener.
 */
export function PairApprovalDialog({ prompt, onResolve }: PairApprovalDialogProps) {
  const [pending, setPending] = useState(false);

  const resolve = (approve: boolean) => {
    setPending(true);
    void onResolve(approve).finally(() => setPending(false));
  };

  return (
    <ProblemDialog title="Allow LeetBook Capture to connect?" onClose={() => resolve(false)}>
      <p className="pair-approval__body">
        A browser extension is asking to send your Accepted submissions to LeetBook. Approve only if
        this code matches the one showing in the extension.
      </p>
      <p className="pair-approval__code">{prompt.code}</p>
      <div className="problem-form__actions">
        <Button variant="ghost" disabled={pending} onClick={() => resolve(false)}>
          Deny
        </Button>
        <Button disabled={pending} onClick={() => resolve(true)}>
          {pending ? "Connecting…" : "Approve"}
        </Button>
      </div>
    </ProblemDialog>
  );
}

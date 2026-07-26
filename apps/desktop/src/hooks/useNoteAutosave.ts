import { createNotesRepo, type SqlExecutor } from "@leetbook/core";
import { useCallback, useEffect, useRef, useState } from "react";

export type NoteSaveState = "idle" | "pending" | "saved" | "error";

interface PendingSave {
  contentJson: string;
  revision: number;
  problemId: string;
}

export function useNoteAutosave(
  db: SqlExecutor,
  problemId: string,
  delayMs: number,
): { saveState: NoteSaveState; handleChange: (contentJson: string) => void } {
  const [saveState, setSaveState] = useState<NoteSaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<PendingSave | null>(null);
  const revision = useRef(0);
  const activeProblemId = useRef(problemId);
  const mounted = useRef(true);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const enqueue = useCallback(
    (save: PendingSave) => {
      queue.current = queue.current
        .catch(() => undefined)
        .then(async () => {
          await createNotesRepo(db).put(save.problemId, save.contentJson, new Date());
          if (
            mounted.current &&
            activeProblemId.current === save.problemId &&
            revision.current === save.revision
          ) {
            setSaveState("saved");
          }
        })
        .catch(() => {
          if (
            mounted.current &&
            activeProblemId.current === save.problemId &&
            revision.current === save.revision
          ) {
            setSaveState("error");
          }
        });
    },
    [db],
  );

  const flushPending = useCallback(() => {
    const save = pending.current;
    if (!save) return;
    pending.current = null;
    enqueue(save);
  }, [enqueue]);

  useEffect(() => {
    activeProblemId.current = problemId;
    mounted.current = true;
    setSaveState("idle");
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      flushPending();
    };
  }, [flushPending, problemId]);

  const handleChange = useCallback(
    (contentJson: string) => {
      revision.current += 1;
      pending.current = { contentJson, revision: revision.current, problemId };
      setSaveState("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        flushPending();
      }, delayMs);
    },
    [delayMs, flushPending, problemId],
  );

  return { saveState, handleChange };
}

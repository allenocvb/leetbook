import { createDesignNotesRepo, createNotesRepo, type SqlExecutor } from "@leetbook/core";
import { useCallback, useEffect, useRef, useState } from "react";

export type NoteSaveState = "idle" | "pending" | "saved" | "error";

interface PendingSave {
  contentJson: string;
  revision: number;
  problemId: string;
}

export interface NoteAutosave {
  saveState: NoteSaveState;
  handleChange: (contentJson: string) => void;
  /**
   * Drop any queued autosave and settle work already in flight. Deleting a subject must
   * call this first: the unmount flush would otherwise write the note back and leave an
   * orphan row pointing at something that no longer exists.
   */
  discardPending: () => Promise<void>;
}

/** Autosave for a problem's notes. */
export function useNoteAutosave(db: SqlExecutor, problemId: string, delayMs: number): NoteAutosave {
  return useAutosave(
    problemId,
    delayMs,
    useCallback(
      async (id, contentJson) => {
        await createNotesRepo(db).put(id, contentJson, new Date());
      },
      [db],
    ),
  );
}

/**
 * Autosave for a design topic's notes.
 *
 * Shares the debounce, revision tracking and unmount-flush logic rather than restating it.
 * That logic carries the subtlety — a delete has to discard before removing the row, or the
 * flush recreates the note it just deleted — and two copies would mean fixing it twice.
 */
export function useDesignNoteAutosave(
  db: SqlExecutor,
  topicId: string,
  delayMs: number,
): NoteAutosave {
  return useAutosave(
    topicId,
    delayMs,
    useCallback(
      async (id, contentJson) => {
        await createDesignNotesRepo(db).put(id, contentJson, new Date());
      },
      [db],
    ),
  );
}

function useAutosave(
  problemId: string,
  delayMs: number,
  write: (subjectId: string, contentJson: string) => Promise<void>,
): NoteAutosave {
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
          await write(save.problemId, save.contentJson);
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
    [write],
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

  const discardPending = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    revision.current += 1; // invalidate any in-flight save's state update
    await queue.current.catch(() => undefined);
  }, []);

  return { saveState, handleChange, discardPending };
}

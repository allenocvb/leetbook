import type { Difficulty, PerformanceScore } from "@leetbook/core";

/**
 * What the extension sends to the desktop app's 127.0.0.1 listener after the
 * user rates a captured Accepted submission.
 */
export interface CapturePayload {
  version: 1;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  score: PerformanceScore;
  runtimeMs: number | null;
  memoryMb: number | null;
  language: string | null;
  codeSnapshot: string | null;
  capturedAt: string;
}

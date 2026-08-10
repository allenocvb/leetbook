import {
  createDesignQuestionsRepo,
  createDesignTopicsRepo,
  type SqlExecutor,
} from "@leetbook/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type QuizProvider, QuizProviderError } from "../../ai/quizProvider.js";
import { DbProvider } from "../../db/DbContext.js";
import { makeDb } from "../../test-utils.js";
import { GenerateQuestionsDialog } from "./GenerateQuestionsDialog.js";

const AT = new Date("2026-08-01T09:00:00.000Z");

const DRAFTS = [
  {
    kind: "choice" as const,
    prompt: "Which store?",
    choices: ["SQL", "KV"],
    answerIndex: 1,
    modelAnswer: "Single-key lookups.",
  },
  { kind: "text" as const, prompt: "How would you shard?", modelAnswer: "By key hash." },
];

const provider = (over: Partial<QuizProvider> = {}): QuizProvider => ({
  generateQuestions: vi.fn(async () => DRAFTS),
  gradeAnswer: vi.fn(),
  ...over,
});

let db: SqlExecutor;
let topicId: string;

beforeEach(async () => {
  db = await makeDb();
  const topic = await createDesignTopicsRepo(db).add(
    { title: "URL shortener", prompt: "Design it.", tags: [] },
    AT,
  );
  topicId = topic.id;
});

function renderDialog({
  loadProvider = async (): Promise<QuizProvider | null> => provider(),
  notes = "Use base62 over an auto-increment id.",
  onSaved = vi.fn(),
} = {}) {
  render(
    <DbProvider db={db}>
      <GenerateQuestionsDialog
        topicId={topicId}
        title="URL shortener"
        prompt="Design it."
        notes={notes}
        onClose={vi.fn()}
        onSaved={onSaved}
        loadProvider={loadProvider}
      />
    </DbProvider>,
  );
  return { onSaved };
}

describe("GenerateQuestionsDialog", () => {
  /*
   * Said before the request, not after. This is the only action in the app that sends the
   * user's own writing to someone else, and it must never be a surprise.
   */
  it("warns that notes will be sent before anything is generated", () => {
    renderDialog();
    expect(screen.getByText(/sends/)).toHaveTextContent(/notes to Anthropic/);
  });

  it("says nothing has been saved yet while asking", () => {
    renderDialog();
    expect(screen.getByText(/Nothing is saved until you review/)).toBeInTheDocument();
  });

  it("warns when a topic has no notes to base questions on", () => {
    renderDialog({ notes: "   " });
    expect(screen.getByText(/no notes yet/)).toBeInTheDocument();
  });

  it("shows every draft in full before saving", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(screen.getByText("Which store?")).toBeInTheDocument());
    expect(screen.getByText("How would you shard?")).toBeInTheDocument();
    // The correct option and the explanation are visible, not hidden behind a save.
    expect(screen.getByText("KV")).toBeInTheDocument();
    expect(screen.getByText("Single-key lookups.")).toBeInTheDocument();
  });

  it("saves nothing until the user says so", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(screen.getByText("Which store?")).toBeInTheDocument());
    expect(await createDesignQuestionsRepo(db).listByTopic(topicId)).toEqual([]);
  });

  it("saves only the drafts that were kept", async () => {
    const { onSaved } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(screen.getByText("Which store?")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Discard: Which store?" }));
    await userEvent.click(screen.getByRole("button", { name: "Save 1" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const stored = await createDesignQuestionsRepo(db).listByTopic(topicId);
    expect(stored.map((q) => q.prompt)).toEqual(["How would you shard?"]);
  });

  it("lets a discard be undone", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(screen.getByText("Which store?")).toBeInTheDocument());

    // The count is interpolated, so it is split across text nodes — match the container.
    const summary = () => screen.getByText(/will be saved/).textContent ?? "";

    await userEvent.click(screen.getByRole("button", { name: "Discard: Which store?" }));
    expect(summary()).toContain("1 of 2");
    await userEvent.click(screen.getByRole("button", { name: "Keep: Which store?" }));

    expect(summary()).toContain("2 of 2");
  });

  it("points at Settings when no key is set, rather than failing obscurely", async () => {
    renderDialog({ loadProvider: async () => null });
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/No API key is set/);
  });

  it("surfaces a provider failure and leaves the topic untouched", async () => {
    renderDialog({
      loadProvider: async () =>
        provider({
          generateQuestions: vi.fn(async () => {
            throw new QuizProviderError("Rate limited by the provider.", "rate-limit");
          }),
        }),
    });

    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Rate limited/);
    expect(await createDesignQuestionsRepo(db).listByTopic(topicId)).toEqual([]);
  });
});

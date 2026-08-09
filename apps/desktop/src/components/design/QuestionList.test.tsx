import {
  createDesignQuestionsRepo,
  createDesignTopicsRepo,
  type SqlExecutor,
} from "@leetbook/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { DbProvider } from "../../db/DbContext.js";
import { makeDb } from "../../test-utils.js";
import { QuestionList } from "./QuestionList.js";

const AT = new Date("2026-08-01T09:00:00.000Z");

let db: SqlExecutor;
let topicId: string;

beforeEach(async () => {
  db = await makeDb();
  const topic = await createDesignTopicsRepo(db).add(
    { title: "URL shortener", prompt: "", tags: [] },
    AT,
  );
  topicId = topic.id;
});

const renderList = async () => {
  render(
    <DbProvider db={db}>
      <QuestionList topicId={topicId} />
    </DbProvider>,
  );
  await waitFor(() => expect(screen.getByRole("region", { name: "Quiz questions" })).toBeVisible());
};

describe("QuestionList", () => {
  it("invites a first question when there are none", async () => {
    await renderList();
    expect(screen.getByText(/No questions yet/)).toBeInTheDocument();
  });

  it("adds a multiple-choice question with the marked answer", async () => {
    await renderList();

    await userEvent.click(screen.getByRole("button", { name: "+ Add question" }));
    const dialog = screen.getByRole("dialog", { name: "New question" });
    await userEvent.type(within(dialog).getByLabelText("Question"), "Which store?");
    await userEvent.type(within(dialog).getByLabelText("Option 1"), "Relational");
    await userEvent.type(within(dialog).getByLabelText("Option 2"), "Key-value");
    await userEvent.click(within(dialog).getByLabelText("Option 2 is correct"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add question" }));

    await waitFor(() => expect(screen.getByText("Which store?")).toBeInTheDocument());
    const stored = await createDesignQuestionsRepo(db).listByTopic(topicId);
    expect(stored[0]).toMatchObject({
      kind: "choice",
      choices: ["Relational", "Key-value"],
      answerIndex: 1,
    });
  });

  /*
   * Blank options are dropped on save, so the marked index has to move with them. Without the
   * remap, leaving a gap above the correct option silently marks a different one correct —
   * the kind of bug that only shows up mid-quiz, as a question that cannot be answered right.
   */
  it("keeps the right option correct when blanks above it are dropped", async () => {
    await renderList();

    await userEvent.click(screen.getByRole("button", { name: "+ Add question" }));
    const dialog = screen.getByRole("dialog", { name: "New question" });
    await userEvent.type(within(dialog).getByLabelText("Question"), "Which store?");
    // Fill options 2 and 3, leaving 1 blank, and mark option 3.
    await userEvent.type(within(dialog).getByLabelText("Option 2"), "Relational");
    await userEvent.type(within(dialog).getByLabelText("Option 3"), "Key-value");
    await userEvent.click(within(dialog).getByLabelText("Option 3 is correct"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add question" }));

    await waitFor(() => expect(screen.getByText("Which store?")).toBeInTheDocument());
    const stored = await createDesignQuestionsRepo(db).listByTopic(topicId);
    expect(stored[0]).toMatchObject({ choices: ["Relational", "Key-value"], answerIndex: 1 });
  });

  it("adds a written-answer question with no options", async () => {
    await renderList();

    await userEvent.click(screen.getByRole("button", { name: "+ Add question" }));
    const dialog = screen.getByRole("dialog", { name: "New question" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Written answer" }));
    await userEvent.type(within(dialog).getByLabelText("Question"), "How would you shard?");
    await userEvent.type(within(dialog).getByLabelText("Model answer"), "By hash of the key.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add question" }));

    await waitFor(() => expect(screen.getByText("How would you shard?")).toBeInTheDocument());
    const stored = await createDesignQuestionsRepo(db).listByTopic(topicId);
    expect(stored[0]?.kind).toBe("text");
    expect(screen.getByText("Written")).toBeInTheDocument();
  });

  it("surfaces the repo's validation rather than saving a broken question", async () => {
    await renderList();

    await userEvent.click(screen.getByRole("button", { name: "+ Add question" }));
    const dialog = screen.getByRole("dialog", { name: "New question" });
    await userEvent.type(within(dialog).getByLabelText("Question"), "Only one option");
    await userEvent.type(within(dialog).getByLabelText("Option 1"), "Lonely");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add question" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/two options/i);
    expect(await createDesignQuestionsRepo(db).listByTopic(topicId)).toEqual([]);
  });

  it("edits and deletes an existing question", async () => {
    await createDesignQuestionsRepo(db).add(topicId, { kind: "text", prompt: "Original" }, AT);
    await renderList();
    await waitFor(() => expect(screen.getByText("Original")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Edit question: Original" }));
    const dialog = screen.getByRole("dialog", { name: "Edit question" });
    const prompt = within(dialog).getByLabelText("Question");
    await userEvent.clear(prompt);
    await userEvent.type(prompt, "Revised");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByText("Revised")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Delete question: Revised" }));
    await waitFor(() => expect(screen.queryByText("Revised")).not.toBeInTheDocument());
  });
});

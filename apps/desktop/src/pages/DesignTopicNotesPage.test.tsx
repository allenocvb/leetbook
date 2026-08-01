import {
  applyDesignReview,
  createDesignNotesRepo,
  createDesignTopicsRepo,
  type SqlExecutor,
} from "@leetbook/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DbProvider } from "../db/DbContext.js";
import { makeDb } from "../test-utils.js";
import { DesignTopicNotesPage } from "./DesignTopicNotesPage.js";

const AT = new Date("2026-08-01T09:00:00.000Z");

async function addTopic(db: SqlExecutor, overrides: Partial<{ prompt: string }> = {}) {
  return createDesignTopicsRepo(db).add(
    {
      title: "URL shortener",
      prompt: "Design a link shortener for 100M links per day.",
      tags: ["Caching", "Sharding"],
      ...overrides,
    },
    AT,
  );
}

async function renderPage({ onBack = vi.fn() } = {}) {
  const db = await makeDb();
  const topic = await addTopic(db);
  const view = render(
    <DbProvider db={db}>
      <DesignTopicNotesPage topicId={topic.id} onBack={onBack} saveDelayMs={0} />
    </DbProvider>,
  );
  await waitFor(() => expect(screen.getByRole("heading", { name: "URL shortener" })).toBeVisible());
  return { db, topic, onBack, ...view };
}

describe("DesignTopicNotesPage", () => {
  it("shows the prompt, tags and an unreviewed schedule", async () => {
    await renderPage();

    expect(screen.getByText(/100M links per day/)).toBeInTheDocument();
    expect(screen.getByText("Caching")).toBeInTheDocument();
    expect(screen.getByText("Sharding")).toBeInTheDocument();
    expect(screen.getByText("Not reviewed yet")).toBeInTheDocument();
  });

  it("omits the prompt block entirely when there is no prompt", async () => {
    const db = await makeDb();
    const topic = await addTopic(db, { prompt: "" });
    render(
      <DbProvider db={db}>
        <DesignTopicNotesPage topicId={topic.id} onBack={vi.fn()} saveDelayMs={0} />
      </DbProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "URL shortener" })).toBeVisible(),
    );
    expect(document.querySelector(".design-topic-header__prompt")).toBeNull();
  });

  it("has no difficulty or LeetCode link, because a design topic has neither", async () => {
    await renderPage();
    expect(screen.queryByText("Difficulty")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /LeetCode/ })).not.toBeInTheDocument();
  });

  it("autosaves edits to the topic's own notes table", async () => {
    const { db, topic } = await renderPage();

    await userEvent.click(screen.getByRole("textbox", { name: "Topic notes" }));
    await userEvent.keyboard("Use a counter plus base62.");

    await waitFor(async () => {
      const note = await createDesignNotesRepo(db).get(topic.id);
      expect(note?.contentJson).toContain("base62");
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("loads notes saved earlier", async () => {
    const db = await makeDb();
    const topic = await addTopic(db);
    await createDesignNotesRepo(db).put(
      topic.id,
      JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Shard by hash." }] }],
      }),
      AT,
    );

    render(
      <DbProvider db={db}>
        <DesignTopicNotesPage topicId={topic.id} onBack={vi.fn()} saveDelayMs={0} />
      </DbProvider>,
    );

    await waitFor(() => expect(screen.getByText("Shard by hash.")).toBeInTheDocument());
  });

  it("shows the schedule once the topic has been reviewed", async () => {
    const db = await makeDb();
    const topic = await addTopic(db);
    await applyDesignReview(db, { topicId: topic.id, score: 4 }, AT);

    render(
      <DbProvider db={db}>
        <DesignTopicNotesPage topicId={topic.id} onBack={vi.fn()} saveDelayMs={0} />
      </DbProvider>,
    );

    await waitFor(() => expect(screen.getByText(/scored 4/)).toBeInTheDocument());
    expect(screen.getByText(/1 reps/)).toBeInTheDocument();
  });

  it("edits the topic in place without leaving the page", async () => {
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Edit topic" }));
    const dialog = screen.getByRole("dialog", { name: "Edit topic" });
    const title = within(dialog).getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Link shortener");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Link shortener" })).toBeVisible(),
    );
  });

  it("deletes the topic behind an inline confirm and navigates back", async () => {
    const { db, topic, onBack } = await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Delete topic" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete URL shortener" }));

    await waitFor(() => expect(onBack).toHaveBeenCalled());
    expect(await createDesignTopicsRepo(db).getById(topic.id)).toBeNull();
  });

  it("does not resurrect the note when a topic is deleted mid-edit", async () => {
    /*
     * The reason delete discards autosave first. Without it the unmount flush writes the
     * note back and leaves an orphan row pointing at a topic that no longer exists.
     */
    const { db, topic } = await renderPage();

    await userEvent.click(screen.getByRole("textbox", { name: "Topic notes" }));
    await userEvent.keyboard("half-written thought");
    await userEvent.click(screen.getByRole("button", { name: "Delete topic" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete URL shortener" }));

    await waitFor(async () =>
      expect(await createDesignTopicsRepo(db).getById(topic.id)).toBeNull(),
    );
    expect(await createDesignNotesRepo(db).get(topic.id)).toBeNull();
  });

  it("says so when the topic does not exist", async () => {
    const db = await makeDb();
    render(
      <DbProvider db={db}>
        <DesignTopicNotesPage topicId="missing" onBack={vi.fn()} saveDelayMs={0} />
      </DbProvider>,
    );

    await waitFor(() => expect(screen.getByText("Topic not found.")).toBeInTheDocument());
  });
});

import type { Editor } from "@tiptap/react";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  badge: string;
  keywords: string;
  run: (editor: Editor, range: { from: number; to: number }) => void;
}

function command(
  id: string,
  label: string,
  description: string,
  badge: string,
  keywords: string,
  run: SlashCommand["run"],
): SlashCommand {
  return { id, label, description, badge, keywords, run };
}

export const SLASH_COMMANDS: SlashCommand[] = [
  command("text", "Text", "Plain paragraph", "T", "paragraph body", (editor, range) => {
    editor.chain().focus().deleteRange(range).clearNodes().setParagraph().run();
  }),
  command("heading-1", "Heading 1", "Large section title", "H1", "title", (editor, range) => {
    editor.chain().focus().deleteRange(range).clearNodes().setHeading({ level: 1 }).run();
  }),
  command("heading-2", "Heading 2", "Section heading", "H2", "subtitle", (editor, range) => {
    editor.chain().focus().deleteRange(range).clearNodes().setHeading({ level: 2 }).run();
  }),
  command("heading-3", "Heading 3", "Small section heading", "H3", "subtitle", (editor, range) => {
    editor.chain().focus().deleteRange(range).clearNodes().setHeading({ level: 3 }).run();
  }),
  command(
    "bullets",
    "Bulleted list",
    "Create a simple list",
    "•",
    "unordered list",
    (editor, range) => {
      editor.chain().focus().deleteRange(range).clearNodes().toggleBulletList().run();
    },
  ),
  command(
    "numbers",
    "Numbered list",
    "Create an ordered list",
    "1.",
    "ordered list",
    (editor, range) => {
      editor.chain().focus().deleteRange(range).clearNodes().toggleOrderedList().run();
    },
  ),
  command("quote", "Quote", "Add a quiet quotation", "“", "blockquote", (editor, range) => {
    editor.chain().focus().deleteRange(range).clearNodes().toggleBlockquote().run();
  }),
  command(
    "callout",
    "Recall callout",
    "Highlight what to remember",
    "!",
    "memory prompt purple",
    (editor, range) => {
      editor.chain().focus().deleteRange(range).clearNodes().setCallout().run();
    },
  ),
  command("code", "Code block", "Add a highlighted snippet", "</>", "snippet", (editor, range) => {
    // Focus last so it applies to the converted block rather than the old "/" position.
    editor.chain().deleteRange(range).clearNodes().setCodeBlock().focus().run();
  }),
];

export function filterSlashCommands(query: string): SlashCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((item) =>
    `${item.label} ${item.keywords}`.toLowerCase().includes(normalized),
  );
}

import type { SqlExecutor } from "../db/executor.js";
import { createNotesRepo } from "../db/repositories/notes.js";
import { createProblemsRepo } from "../db/repositories/problems.js";
import type { Problem } from "../types.js";

interface TipTapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: { type: string }[];
}

/**
 * Best-effort TipTap JSON → Markdown. Handles the node types LeetBook's editor
 * uses (paragraphs, headings, code blocks, lists, bold/italic/code marks).
 * Unknown nodes degrade to their text content rather than being dropped.
 */
export function tiptapToMarkdown(contentJson: string): string {
  let doc: TipTapNode;
  try {
    doc = JSON.parse(contentJson) as TipTapNode;
  } catch {
    return contentJson; // not JSON — return as-is rather than losing data
  }
  return (doc.content ?? [])
    .map((node) => renderBlock(node))
    .join("\n\n")
    .trim();
}

function renderBlock(node: TipTapNode): string {
  switch (node.type) {
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
      return `${"#".repeat(Math.min(level, 6))} ${renderInline(node.content)}`;
    }
    case "codeBlock": {
      const language = typeof node.attrs?.language === "string" ? node.attrs.language : "";
      return `\`\`\`${language}\n${renderInline(node.content)}\n\`\`\``;
    }
    case "bulletList":
      return (node.content ?? [])
        .map((item) => `- ${renderInline(item.content?.[0]?.content)}`)
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map((item, i) => `${i + 1}. ${renderInline(item.content?.[0]?.content)}`)
        .join("\n");
    case "blockquote":
      return (node.content ?? []).map((child) => `> ${renderBlock(child)}`).join("\n");
    default:
      return renderInline(node.content);
  }
}

function renderInline(nodes: TipTapNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      let text = node.text ?? renderInline(node.content);
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") text = `**${text}**`;
        else if (mark.type === "italic") text = `*${text}*`;
        else if (mark.type === "code") text = `\`${text}\``;
      }
      return text;
    })
    .join("");
}

export interface NoteExport {
  slug: string;
  markdown: string;
}

/** One Markdown document per problem that has a note, with a metadata header. */
export async function exportNotesMarkdown(db: SqlExecutor): Promise<NoteExport[]> {
  const problems = createProblemsRepo(db);
  const notes = createNotesRepo(db);
  const out: NoteExport[] = [];
  for (const problem of await problems.listAll()) {
    const note = await notes.get(problem.id);
    if (!note) continue;
    out.push({ slug: problem.slug, markdown: renderDocument(problem, note.contentJson) });
  }
  return out;
}

function renderDocument(problem: Problem, contentJson: string): string {
  const tags = problem.tags.length > 0 ? problem.tags.join(", ") : "—";
  return [
    `# ${problem.title}`,
    "",
    `> ${problem.difficulty} · ${tags} · [LeetCode](${problem.url})`,
    "",
    tiptapToMarkdown(contentJson),
    "",
  ].join("\n");
}

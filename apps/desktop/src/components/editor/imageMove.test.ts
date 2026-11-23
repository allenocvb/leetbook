import { Schema } from "@tiptap/pm/model";
import { EditorState, NodeSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { insertionPoint, moveNode } from "./imageMove.js";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: {},
    paragraph: { group: "block", content: "text*" },
    image: { group: "block", atom: true },
  },
});
const p = (text: string) => schema.node("paragraph", null, [schema.text(text)]);
const doc = schema.node("doc", null, [p("one"), schema.node("image"), p("two"), p("three")]);
const names = (state: EditorState) => {
  const out: string[] = [];
  state.doc.forEach((node) => {
    out.push(node.type.name === "image" ? "image" : node.textContent);
  });
  return out;
};

describe("insertionPoint", () => {
  const blocks = [
    { pos: 0, top: 0, bottom: 20 },
    { pos: 5, top: 20, bottom: 120 },
    { pos: 6, top: 120, bottom: 140 },
  ];
  it("lands before the first block whose middle is below the pointer", () => {
    expect(insertionPoint(blocks, 5, 99)).toBe(0);
    expect(insertionPoint(blocks, 15, 99)).toBe(5);
    expect(insertionPoint(blocks, 125, 99)).toBe(6);
  });
  it("lands at the end below every block", () => {
    expect(insertionPoint(blocks, 500, 99)).toBe(99);
  });
});

describe("moveNode", () => {
  const state = EditorState.create({ doc });
  const imageAt = 5;
  it("moves an image above text and selects it", () => {
    const tr = moveNode(state.tr, imageAt, 0);
    expect(tr).not.toBeNull();
    const next = state.apply(tr as NonNullable<typeof tr>);
    expect(names(next)).toEqual(["image", "one", "two", "three"]);
    expect(next.selection).toBeInstanceOf(NodeSelection);
    expect((next.selection as NodeSelection).node.type.name).toBe("image");
  });
  it("moves an image down past later blocks", () => {
    const next = state.apply(moveNode(state.tr, imageAt, doc.content.size) as never);
    expect(names(next)).toEqual(["one", "two", "three", "image"]);
  });
  it("does nothing when dropped where it already is", () => {
    expect(moveNode(state.tr, imageAt, imageAt)).toBeNull();
    expect(moveNode(state.tr, imageAt, imageAt + 1)).toBeNull();
  });
});

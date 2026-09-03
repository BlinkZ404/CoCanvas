import { describe, expect, it } from "vitest";
import { MIN_NODE_H, MIN_NODE_W } from "../geometry/board";
import { sanitizePersisted, useCanvasStore } from "./canvasStore";

function store() {
  return useCanvasStore.getState();
}

describe("canvasStore", () => {
  it("adds a rectangle with defaults and selects it", () => {
    const el = store().addElement({ kind: "rectangle" }, "human");
    expect(el.id).toMatch(/^rectangle_/);
    expect(el.width).toBeGreaterThan(0);
    expect(store().selectedId).toBe(el.id);
    expect(store().activity[0]?.message).toMatch(/added/);
  });

  it("ignores a caller-supplied id", () => {
    const first = store().addElement({ kind: "rectangle", id: "stolen" } as { kind: "rectangle"; id: string }, "human");
    expect(first.id).not.toBe("stolen");
    const second = store().addElement({ kind: "rectangle", id: first.id } as { kind: "rectangle"; id: string }, "human");
    expect(second.id).not.toBe(first.id);
  });

  it("clamps size and drops NaN geometry", () => {
    const el = store().addElement({ kind: "rectangle", width: 2, height: Number.NaN, x: Number.NaN }, "human");
    expect(el.width).toBe(MIN_NODE_W);
    expect(el.height).toBeGreaterThanOrEqual(MIN_NODE_H);
    expect(Number.isFinite(el.x)).toBe(true);
    expect(el.x).toBeGreaterThanOrEqual(0);
    store().updateElement(el.id, { width: 4 });
    expect(store().elements[0].width).toBe(MIN_NODE_W);
  });

  it("does not checkpoint a missing update or a no-op brief", () => {
    store().setBrief("Checkout", "human");
    const depth = store().undoDepth;
    expect(store().updateElement("missing", { x: 10 })).toBeNull();
    expect(store().undoDepth).toBe(depth);
    store().setBrief("Checkout", "human");
    expect(store().undoDepth).toBe(depth);
  });

  it("rejects garbage persisted boards and fills missing fields", () => {
    expect(sanitizePersisted({ elements: "nope" })).toBeNull();
    expect(sanitizePersisted({ elements: [null, { kind: "mystery" }] })?.elements).toEqual([]);
    const snap = sanitizePersisted({
      elements: [{ kind: "rectangle", text: "Pay" }],
      connectors: [{ id: "c1", from: "a", to: "b" }, { id: 3 }],
      pins: [{ id: "p1", elementId: "x", text: "Look" }],
      selectedId: "gone",
    });
    expect(snap?.elements[0]?.text).toBe("Pay");
    expect(snap?.elements[0]?.width).toBeGreaterThan(0);
    expect(snap?.connectors).toEqual([{ id: "c1", from: "a", to: "b", label: "" }]);
    expect(snap?.pins[0]?.id).toBe("p1");
    expect(snap?.selectedId).toBeNull();
  });

  it("clamps negative positions", () => {
    const el = store().addElement({ kind: "text", x: 40, y: 40 }, "human");
    store().updateElement(el.id, { x: -12, y: -4 }, "human");
    const live = store().elements[0];
    expect(live.x).toBe(0);
    expect(live.y).toBe(0);
  });

  it("connects two nodes, rejects a self-loop, and reverses the arrow", () => {
    const a = store().addElement({ kind: "ellipse", text: "Start" }, "human");
    const b = store().addElement({ kind: "rectangle", text: "Next" }, "human");
    expect(store().connect(a.id, a.id, "loop", "human")).toBeNull();
    const conn = store().connect(a.id, b.id, "next", "human");
    expect(conn?.from).toBe(a.id);
    expect(store().connect(a.id, b.id, "again", "human")?.id).toBe(conn?.id);
    const reversed = store().reverseConnector(conn!.id, "human");
    expect(reversed).toEqual(expect.objectContaining({ from: b.id, to: a.id }));
  });

  it("deletes a node and its connectors and pins", () => {
    const a = store().addElement({ kind: "rectangle", text: "A" }, "human");
    const b = store().addElement({ kind: "rectangle", text: "B" }, "human");
    store().connect(a.id, b.id, "next", "human");
    store().addPin(a.id, "Fix this", "human");
    expect(store().deleteElement(a.id, "human")).toBe(true);
    expect(store().elements.map((e) => e.id)).toEqual([b.id]);
    expect(store().connectors).toEqual([]);
    expect(store().pins).toEqual([]);
  });

  it("duplicates, layers, and nudges", () => {
    const a = store().addElement({ kind: "sticky", text: "Note", x: 40, y: 40 }, "human");
    const b = store().addElement({ kind: "text", text: "Title" }, "human");
    const copy = store().duplicateElement(a.id, "human");
    expect(copy?.x).toBe(a.x + 24);
    expect(copy?.text).toBe("Note");
    store().layerElement(a.id, "front", "human");
    expect(store().elements.find((e) => e.id === a.id)?.z).toBeGreaterThan(
      store().elements.find((e) => e.id === b.id)?.z ?? 0
    );
    store().nudgeElement(a.id, -1000, 10, "human");
    expect(store().elements.find((e) => e.id === a.id)?.x).toBe(0);
  });

  it("aligns a free node to the page box", () => {
    const el = store().addElement({ kind: "rectangle", x: 200, y: 200, width: 100, height: 50 }, "human");
    store().alignElement(el.id, "left", "human");
    expect(store().elements[0].x).toBe(40);
    store().alignElement(el.id, "top", "human");
    expect(store().elements[0].y).toBe(40);
  });

  it("aligns a child inside its frame", () => {
    const frame = store().addElement({ kind: "frame", x: 80, y: 80, width: 320, height: 220 }, "human");
    const child = store().addElement({ kind: "rectangle", x: 120, y: 140, width: 80, height: 40 }, "human");
    store().alignElement(child.id, "left", "human");
    expect(store().elements.find((e) => e.id === child.id)?.x).toBe(frame.x + 16);
  });

  it("records one undo for a gesture and can redo it", () => {
    const el = store().addElement({ kind: "rectangle", x: 80, y: 80 }, "human");
    store().beginGesture();
    store().moveElement(el.id, 90, 90, "human", { log: false });
    store().moveElement(el.id, 140, 120, "human", { log: false });
    store().endGesture();
    expect(store().elements[0].x).toBe(140);
    expect(store().undo()).toBe(true);
    expect(store().elements[0].x).toBe(80);
    expect(store().redo()).toBe(true);
    expect(store().elements[0].x).toBe(140);
  });

  it("arms connect, picks two nodes, and cancels", () => {
    const a = store().addElement({ kind: "ellipse" }, "human");
    const b = store().addElement({ kind: "rectangle" }, "human");
    store().armConnect();
    expect(store().connectArmed).toBe(true);
    store().pickConnect(a.id);
    store().pickConnect(b.id);
    expect(store().connectors).toHaveLength(1);
    expect(store().connectArmed).toBe(false);
    store().armConnect();
    store().cancelConnect();
    expect(store().connectArmed).toBe(false);
  });

  it("clears the board but keeps the brief", () => {
    store().setBrief("Checkout", "human");
    store().addElement({ kind: "text" }, "human");
    store().clearAll("human");
    expect(store().elements).toEqual([]);
    expect(store().brief).toBe("Checkout");
  });

  it("arranges nodes on a grid and tracks pins", () => {
    store().addElement({ kind: "rectangle", x: 10, y: 10 }, "human");
    store().addElement({ kind: "rectangle", x: 20, y: 20 }, "human");
    store().addElement({ kind: "rectangle", x: 30, y: 30 }, "human");
    expect(store().arrangeGrid(2, "human")).toBe(3);
    const xs = store().elements.map((e) => e.x);
    expect(new Set(xs).size).toBe(2);
    const pin = store().addPin(store().elements[0].id, "  Missing payment  ", "human");
    expect(pin?.text).toBe("Missing payment");
    expect(store().resolvePin(pin!.id, "human")).toBe(true);
    expect(store().pins[0].resolved).toBe(true);
  });
});

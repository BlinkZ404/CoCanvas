import { beforeAll, describe, expect, it } from "vitest";
import { pushConfirmBypass } from "../confirmAction";
import { useCanvasStore } from "../store/canvasStore";
import { resultToText } from "./polyfill";
import { persistThemePref } from "../theme";
import { DARK_BOARD } from "../theme";
import { SAMPLE_BRIEF, registerCoCanvasTools } from "./registerTools";

function store() {
  return useCanvasStore.getState();
}

async function call(name: string, input: unknown = {}) {
  const { modelContext } = registerCoCanvasTools();
  const result = await modelContext.executeTool(name, input);
  return resultToText(result);
}

describe("registerCoCanvasTools", () => {
  beforeAll(() => {
    registerCoCanvasTools();
  });

  it("registers the read tools on an empty board", () => {
    const info = registerCoCanvasTools();
    expect(info.polyfilled).toBe(true);
    expect(info.toolNames).toEqual(expect.arrayContaining(["get_brief", "get_canvas_summary", "list_elements", "add_element"]));
    expect(info.toolNames).not.toContain("draft_from_brief");
  });

  it("sets a brief, drafts a flow, and reviews it", async () => {
    await expect(call("get_brief")).resolves.toMatch(/No brief yet/);
    await call("set_brief", { brief: SAMPLE_BRIEF });
    expect(store().brief).toContain("Grocery checkout");
    const draft = await call("draft_from_brief");
    expect(draft).toMatch(/drafted/i);
    expect(store().elements.length).toBeGreaterThan(3);
    expect(store().connectors.length).toBeGreaterThan(0);
    const review = await call("review_canvas");
    expect(review).toMatch(/summary|finding|brief/i);
  });

  it("drafts onto a dark board when the chrome theme is dark", async () => {
    persistThemePref("dark");
    await call("set_brief", { brief: SAMPLE_BRIEF });
    await call("draft_from_brief");
    expect(store().background.toLowerCase()).toBe(DARK_BOARD);
  });

  it("adds, updates, moves, duplicates, and deletes through tools", async () => {
    const added = await call("add_element", { kind: "rectangle", text: "Pay", x: 40, y: 40 });
    const id = store().elements.find((e) => e.text === "Pay")?.id;
    expect(id).toBeTruthy();
    expect(added).toContain(id);
    await call("update_element", { id, text: "Payment", width: 180 });
    expect(store().elements.find((e) => e.id === id)?.text).toBe("Payment");
    await call("move_element", { id, x: 88, y: 64 });
    expect(store().elements.find((e) => e.id === id)?.x).toBe(88);
    await call("duplicate_element", { id });
    expect(store().elements.length).toBe(2);
    pushConfirmBypass();
    await call("delete_element", { id });
    expect(store().elements.some((e) => e.id === id)).toBe(false);
  });

  it("connects, reverses, pins, and builds a login layout", async () => {
    const a = store().addElement({ kind: "ellipse", text: "Start" }, "human");
    const b = store().addElement({ kind: "rectangle", text: "Next" }, "human");
    await call("connect_elements", { from: a.id, to: b.id, label: "next" });
    expect(store().connectors[0]?.label).toBe("next");
    await call("reverse_connector", { id: store().connectors[0].id });
    expect(store().connectors[0]?.from).toBe(b.id);
    await call("pin_element", { id: b.id, note: "Add a CTA" });
    expect(store().pins[0]?.text).toMatch(/CTA/);
    await call("resolve_pin", { id: store().pins[0].id });
    expect(store().pins[0]?.resolved).toBe(true);
    pushConfirmBypass();
    await call("clear_canvas");
    await call("create_layout", { template: "login" });
    expect(store().elements.some((e) => e.text === "Welcome back")).toBe(true);
    expect(store().elements.some((e) => e.kind === "frame")).toBe(true);
  });

  it("replaces an existing board when creating a layout", async () => {
    store().addElement({ kind: "rectangle", text: "Old node" }, "human");
    await call("create_layout", { template: "login" });
    expect(store().elements.some((e) => e.text === "Old node")).toBe(false);
    expect(store().elements.some((e) => e.text === "Welcome back")).toBe(true);
  });

  it("ignores a supplied id on add_element", async () => {
    await call("add_element", { kind: "rectangle", id: "stolen", text: "Forced" });
    const el = store().elements.find((e) => e.text === "Forced");
    expect(el?.id).toBeTruthy();
    expect(el?.id).not.toBe("stolen");
  });
});

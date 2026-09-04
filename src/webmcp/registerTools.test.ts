import { beforeAll, describe, expect, it } from "vitest";
import { pushConfirmBypass } from "../confirmAction";
import { useCanvasStore } from "../store/canvasStore";
import { resultToText } from "./polyfill";
import { persistThemePref } from "../theme";
import { DARK_BOARD } from "../theme";
import { SAMPLE_BRIEF, refreshNativeBinding, registerCoCanvasTools } from "./registerTools";

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

  it("refuses arrows on score bars and sibling side arrows", async () => {
    store().clearAll("human");
    const hub = store().addElement({ kind: "ellipse", text: "Astra", x: 400, y: 0, width: 220, height: 80 }, "human");
    const who = store().addElement(
      { kind: "rectangle", text: "WHO GETS IT", x: 300, y: 200, width: 220, height: 120 },
      "human"
    );
    const caps = store().addElement(
      { kind: "rectangle", text: "CAPABILITIES", x: 40, y: 200, width: 220, height: 120 },
      "human"
    );
    const bar = store().addElement({ kind: "rectangle", text: "", x: 40, y: 400, width: 400, height: 28 }, "human");
    const score = store().addElement(
      { kind: "text", text: "FrontierMath", x: 40, y: 440, width: 180, height: 24 },
      "human"
    );
    await call("connect_elements", { from: hub.id, to: who.id, label: "Who" });
    await call("connect_elements", { from: hub.id, to: caps.id, label: "Capabilities" });
    const side = await call("connect_elements", { from: who.id, to: caps.id, label: "" });
    expect(side).toMatch(/side arrow/i);
    expect(store().connectors.some((c) => c.from === who.id && c.to === caps.id)).toBe(false);
    const onBar = await call("connect_elements", { from: caps.id, to: bar.id });
    expect(onBar).toMatch(/score bar/i);
    expect(store().connectors.some((c) => c.to === bar.id)).toBe(false);
    const onLabel = await call("connect_elements", { from: score.id, to: bar.id });
    expect(onLabel).toMatch(/score bar|free text/i);
    expect(store().connectors.some((c) => c.from === score.id)).toBe(false);
    const loop = await call("connect_elements", { from: hub.id, to: hub.id });
    expect(loop).toMatch(/itself/);
  });

  it("connects, reverses, and pins through tools", async () => {
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
  });

  it("drafts from the words in the brief, not a named template", async () => {
    await call("set_brief", { brief: "ChatGPT login: welcome back, email address, continue" });
    await call("draft_from_brief");
    expect(store().elements.some((e) => /welcome back/i.test(e.text))).toBe(true);
    expect(store().elements.some((e) => /email address/i.test(e.text))).toBe(true);
    await call("set_brief", { brief: "Search the web and rank frontier models including Astra" });
    await call("draft_from_brief");
    expect(store().elements.some((e) => /welcome back/i.test(e.text))).toBe(false);
    expect(store().elements.some((e) => /Astra/i.test(e.text))).toBe(true);
  });

  it("replaces an existing board when drafting from a brief", async () => {
    store().addElement({ kind: "rectangle", text: "Old node" }, "human");
    await call("set_brief", { brief: "Start, process, end" });
    await call("draft_from_brief");
    expect(store().elements.some((e) => e.text === "Old node")).toBe(false);
    expect(store().elements.some((e) => e.text === "Start")).toBe(true);
  });

  it("ignores a supplied id on add_element", async () => {
    await call("add_element", { kind: "rectangle", id: "stolen", text: "Forced" });
    const el = store().elements.find((e) => e.text === "Forced");
    expect(el?.id).toBeTruthy();
    expect(el?.id).not.toBe("stolen");
  });

  it("exposes the same tools on window.__cocanvasTools", async () => {
    registerCoCanvasTools();
    expect(window.__cocanvasTools?.list()).toEqual(expect.arrayContaining(["get_brief", "get_canvas_summary"]));
    const summary = await window.__cocanvasTools!.execute("get_canvas_summary", {});
    expect(summary).toMatch(/Your brief\. Your board\. Your agent/);
  });

  it("registers the live set on a late native host", () => {
    const names: string[] = [];
    const host = {
      registerTool: (tool: { name: string }) => {
        names.push(tool.name);
      },
    };
    (window as unknown as { modelContext?: typeof host }).modelContext = host;
    expect(refreshNativeBinding()).toBe(true);
    expect(names).toEqual(expect.arrayContaining(["get_brief", "get_canvas_summary"]));
    delete (window as unknown as { modelContext?: typeof host }).modelContext;
  });
});

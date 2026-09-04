import { describe, expect, it } from "vitest";
import { box } from "../test/helpers";
import { blockedConnectorReason, briefTerms, reviewCanvas } from "./reviewCanvas";

describe("briefTerms", () => {
  it("extracts the checkout steps and drops stop words", () => {
    const terms = briefTerms(
      "Grocery checkout: cart review, delivery address, payment, order success. Every step labeled."
    );
    expect(terms.map((t) => t.toLowerCase())).toEqual(
      expect.arrayContaining(["cart review", "delivery address", "payment", "order success"])
    );
    expect(terms.map((t) => t.toLowerCase())).not.toContain("every");
  });
});

describe("reviewCanvas", () => {
  it("flags an empty board and a missing brief", () => {
    const report = reviewCanvas({ brief: "", elements: [], connectors: [], pins: [] });
    expect(report.findings.some((f) => f.code === "empty")).toBe(true);
    expect(report.findings.some((f) => f.code === "no_brief")).toBe(true);
  });

  it("reports a brief gap when a step is missing", () => {
    const cart = box({ id: "a", kind: "ellipse", text: "Cart review" });
    const report = reviewCanvas({
      brief: "Cart review, payment",
      elements: [cart],
      connectors: [],
      pins: [],
    });
    expect(report.missingTerms.some((t) => t.toLowerCase().includes("payment"))).toBe(true);
    expect(report.findings.some((f) => f.code === "brief_gap")).toBe(true);
  });

  it("warns about unlabeled shapes, orphans, and overlap", () => {
    const a = box({ id: "a", x: 0, y: 0, width: 120, height: 80, text: "" });
    const b = box({ id: "b", x: 10, y: 10, width: 120, height: 80, text: "Next" });
    const c = box({ id: "c", x: 400, y: 0, width: 100, height: 60, text: "End" });
    const report = reviewCanvas({
      brief: "Next",
      elements: [a, b, c],
      connectors: [{ id: "conn", from: "b", to: "c", label: "next" }],
      pins: [{ id: "p1", elementId: "c", actor: "human", text: "Check this", resolved: false }],
    });
    expect(report.findings.some((f) => f.code === "unlabeled")).toBe(true);
    expect(report.findings.some((f) => f.code === "overlap")).toBe(true);
    expect(report.findings.some((f) => f.code === "orphan")).toBe(true);
    expect(report.findings.some((f) => f.code === "open_pins")).toBe(true);
  });

  it("warns when a board is type with no connectors", () => {
    const report = reviewCanvas({
      brief: "GPT-6 Astra map",
      elements: [
        box({ id: "t", kind: "text", text: "GPT-6 Astra", width: 400, height: 40 }),
        box({ id: "k", kind: "text", text: "Product note", y: 50, width: 280, height: 24 }),
        box({ id: "r", kind: "rectangle", y: 90, width: 640, height: 1, text: "" }),
      ],
      connectors: [],
      pins: [],
    });
    expect(report.findings.some((f) => f.code === "no_diagram")).toBe(true);
    expect(report.findings.some((f) => f.code === "unlabeled")).toBe(false);
  });

  it("warns when free text sits on a connector label", () => {
    const hub = box({ id: "hub", x: 200, y: 0, width: 160, height: 80, text: "Astra" });
    const api = box({ id: "api", x: 200, y: 220, width: 160, height: 80, text: "API" });
    const stray = box({
      id: "stray",
      kind: "text",
      x: 240,
      y: 110,
      width: 180,
      height: 40,
      text: "Computer use. Browsing.",
    });
    const report = reviewCanvas({
      brief: "Astra API",
      elements: [hub, api, stray],
      connectors: [{ id: "c1", from: "hub", to: "api", label: "API" }],
      pins: [],
    });
    expect(report.findings.some((f) => f.code === "overlap" && f.message.includes("arrow"))).toBe(true);
  });

  it("does not treat score bars as orphans on a hub map", () => {
    const hub = box({ id: "hub", kind: "ellipse", x: 400, y: 0, width: 220, height: 80, text: "Astra" });
    const caps = box({ id: "caps", x: 40, y: 200, width: 220, height: 120, text: "CAPABILITIES" });
    const who = box({ id: "who", x: 300, y: 200, width: 220, height: 120, text: "WHO GETS IT" });
    const bar = box({ id: "bar", x: 40, y: 400, width: 400, height: 28, text: "" });
    const report = reviewCanvas({
      brief: "Astra map",
      elements: [hub, caps, who, bar],
      connectors: [
        { id: "c1", from: "hub", to: "caps", label: "Capabilities" },
        { id: "c2", from: "hub", to: "who", label: "Who" },
      ],
      pins: [],
    });
    expect(report.findings.some((f) => f.code === "orphan")).toBe(false);
    expect(report.findings.some((f) => f.code === "score_link")).toBe(false);
    expect(report.findings.some((f) => f.code === "side_link")).toBe(false);
  });

  it("flags a side arrow between siblings that already hang from the hub", () => {
    const hub = box({ id: "hub", kind: "ellipse", x: 400, y: 0, width: 220, height: 80, text: "Astra" });
    const who = box({ id: "who", x: 300, y: 200, width: 220, height: 120, text: "WHO GETS IT" });
    const caps = box({ id: "caps", x: 40, y: 200, width: 220, height: 120, text: "CAPABILITIES" });
    const report = reviewCanvas({
      brief: "Astra",
      elements: [hub, who, caps],
      connectors: [
        { id: "c1", from: "hub", to: "who", label: "Who" },
        { id: "c2", from: "hub", to: "caps", label: "Capabilities" },
        { id: "c3", from: "who", to: "caps", label: "" },
      ],
      pins: [],
    });
    expect(report.findings.some((f) => f.code === "side_link")).toBe(true);
  });

  it("flags arrows on score bars and score labels", () => {
    const name = box({ id: "name", kind: "text", x: 40, y: 400, width: 180, height: 24, text: "FrontierMath" });
    const bar = box({ id: "bar", x: 230, y: 400, width: 400, height: 28, text: "" });
    const report = reviewCanvas({
      brief: "Scores",
      elements: [name, bar],
      connectors: [{ id: "c1", from: "name", to: "bar", label: "" }],
      pins: [],
    });
    expect(report.findings.some((f) => f.code === "score_link")).toBe(true);
  });

  it("flags a hub stretched across the child row", () => {
    const hub = box({ id: "hub", kind: "ellipse", x: 40, y: 0, width: 1200, height: 90, text: "Astra" });
    const a = box({ id: "a", x: 40, y: 200, width: 220, height: 120, text: "Who" });
    const b = box({ id: "b", x: 320, y: 200, width: 220, height: 120, text: "API" });
    const c = box({ id: "c", x: 600, y: 200, width: 220, height: 120, text: "Rollout" });
    const report = reviewCanvas({
      brief: "Astra",
      elements: [hub, a, b, c],
      connectors: [
        { id: "c1", from: "hub", to: "a", label: "Who" },
        { id: "c2", from: "hub", to: "b", label: "API" },
        { id: "c3", from: "hub", to: "c", label: "Rollout" },
      ],
      pins: [],
    });
    expect(report.findings.some((f) => f.code === "wide_hub")).toBe(true);
  });

  it("does not flag a compact hub as stretched", () => {
    const hub = box({ id: "hub", kind: "ellipse", x: 400, y: 0, width: 320, height: 100, text: "Astra" });
    const a = box({ id: "a", x: 40, y: 200, width: 220, height: 120, text: "Who" });
    const b = box({ id: "b", x: 320, y: 200, width: 220, height: 120, text: "API" });
    const c = box({ id: "c", x: 600, y: 200, width: 220, height: 120, text: "Rollout" });
    const report = reviewCanvas({
      brief: "Astra",
      elements: [hub, a, b, c],
      connectors: [
        { id: "c1", from: "hub", to: "a", label: "Who" },
        { id: "c2", from: "hub", to: "b", label: "API" },
        { id: "c3", from: "hub", to: "c", label: "Rollout" },
      ],
      pins: [],
    });
    expect(report.findings.some((f) => f.code === "wide_hub")).toBe(false);
  });

  it("flags a side arrow when children point up at the hub", () => {
    const hub = box({ id: "hub", kind: "ellipse", x: 400, y: 0, width: 220, height: 80, text: "Astra" });
    const who = box({ id: "who", x: 300, y: 200, width: 220, height: 120, text: "WHO GETS IT" });
    const caps = box({ id: "caps", x: 40, y: 200, width: 220, height: 120, text: "CAPABILITIES" });
    const report = reviewCanvas({
      brief: "Astra",
      elements: [hub, who, caps],
      connectors: [
        { id: "c1", from: "who", to: "hub", label: "Who" },
        { id: "c2", from: "caps", to: "hub", label: "Capabilities" },
        { id: "c3", from: "who", to: "caps", label: "" },
      ],
      pins: [],
    });
    expect(report.findings.some((f) => f.code === "side_link")).toBe(true);
  });

  it("does not flag a linear grocery row as a side arrow", () => {
    const cart = box({ id: "cart", x: 40, y: 80, width: 160, height: 80, text: "Cart" });
    const addr = box({ id: "addr", x: 240, y: 80, width: 160, height: 80, text: "Address" });
    const pay = box({ id: "pay", x: 440, y: 80, width: 160, height: 80, text: "Payment" });
    const report = reviewCanvas({
      brief: "Cart review, delivery address, payment",
      elements: [cart, addr, pay],
      connectors: [
        { id: "c1", from: "cart", to: "addr", label: "next" },
        { id: "c2", from: "addr", to: "pay", label: "next" },
      ],
      pins: [],
    });
    expect(report.findings.some((f) => f.code === "side_link")).toBe(false);
    expect(report.findings.some((f) => f.code === "score_link")).toBe(false);
  });

  it("blockedConnectorReason matches review: refuse score bars and sibling sides", () => {
    const hub = box({ id: "hub", kind: "ellipse", x: 400, y: 0, width: 220, height: 80, text: "Astra" });
    const who = box({ id: "who", x: 300, y: 200, width: 220, height: 120, text: "WHO GETS IT" });
    const caps = box({ id: "caps", x: 40, y: 200, width: 220, height: 120, text: "CAPABILITIES" });
    const bar = box({ id: "bar", x: 40, y: 400, width: 400, height: 28, text: "" });
    const hubLinks = [
      { id: "c1", from: "hub", to: "who", label: "Who" },
      { id: "c2", from: "hub", to: "caps", label: "Capabilities" },
    ];
    const elements = [hub, who, caps, bar];
    expect(blockedConnectorReason(who, caps, elements, hubLinks)).toMatch(/hang from the hub/);
    expect(blockedConnectorReason(caps, bar, elements, hubLinks)).toMatch(/score bar/);
    expect(blockedConnectorReason(hub, who, elements, [])).toBeNull();
  });

  it("covers the brief when every term is on the board", () => {
    const start = box({ id: "a", kind: "ellipse", text: "Start" });
    const end = box({ id: "b", kind: "ellipse", x: 200, text: "End" });
    const report = reviewCanvas({
      brief: "Start then End",
      elements: [start, end],
      connectors: [{ id: "c", from: "a", to: "b", label: "next" }],
      pins: [],
    });
    expect(report.missingTerms).toEqual([]);
    expect(report.summary).toMatch(/covers the brief/i);
  });
});

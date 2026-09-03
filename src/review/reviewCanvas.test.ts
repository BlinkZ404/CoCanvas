import { describe, expect, it } from "vitest";
import { box } from "../test/helpers";
import { briefTerms, reviewCanvas } from "./reviewCanvas";

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

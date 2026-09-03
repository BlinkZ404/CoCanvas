import { describe, expect, it } from "vitest";
import { clipLabel, connectorName, elementName, itemName, kindWord } from "./labels";
import { box } from "./test/helpers";

describe("labels", () => {
  it("clips long names", () => {
    expect(clipLabel("a".repeat(40)).endsWith("...")).toBe(true);
    expect(clipLabel("Cart")).toBe("Cart");
  });

  it("quotes a labeled node and falls back to the kind", () => {
    expect(elementName({ kind: "rectangle", text: "Delivery address" })).toBe('"Delivery address"');
    expect(elementName({ kind: "ellipse", text: "  " })).toBe("an ellipse");
    expect(elementName({ kind: "rectangle", text: "" })).toBe("a rectangle");
  });

  it("names connectors and unknown ids", () => {
    expect(connectorName({ label: "next" })).toBe('"next"');
    expect(connectorName({ label: "" })).toBe("a connector");
    const el = box({ id: "rect_1", text: "Pay" });
    expect(itemName({ elements: [el], connectors: [] }, "rect_1")).toBe('"Pay"');
    expect(itemName({ elements: [], connectors: [{ id: "c1", from: "a", to: "b", label: "go" }] }, "c1")).toBe(
      '"go"'
    );
    expect(itemName({ elements: [], connectors: [] }, "missing")).toBe("that item");
  });

  it("maps kinds to words", () => {
    expect(kindWord("sticky")).toBe("Sticky note");
    expect(kindWord("mystery")).toBe("mystery");
  });
});

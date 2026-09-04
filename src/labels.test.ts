import { describe, expect, it } from "vitest";
import { clipLabel, connectorName, elementName, headingLines, itemName, kindWord, plainCopy, stackHeading } from "./labels";
import { box } from "./test/helpers";

describe("labels", () => {
  it("strips em dashes and curly quotes", () => {
    expect(plainCopy("GPT-6 Astra \u2014 product")).toBe("GPT-6 Astra - product");
    expect(plainCopy("\u201CWho gets it\u201D")).toBe('"Who gets it"');
  });

  it("puts an all-caps heading on its own line", () => {
    expect(stackHeading("WHO GETS IT Plus. Pro. Business. Enterprise.")).toBe(
      "WHO GETS IT\nPlus. Pro. Business. Enterprise."
    );
    expect(stackHeading("CAPABILITIES Computer use. Browsing.")).toBe("CAPABILITIES\nComputer use. Browsing.");
    expect(stackHeading("API gpt-6-astra $10 input.")).toBe("API\ngpt-6-astra $10 input.");
    expect(stackHeading("Cart review")).toBe("Cart review");
    expect(stackHeading("GPT-6 Astra")).toBe("GPT-6 Astra");
    expect(headingLines("WHO GETS IT Plus. Pro.")).toEqual({
      kicker: "WHO GETS IT",
      detail: "Plus. Pro.",
    });
  });

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

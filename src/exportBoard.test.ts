import { describe, expect, it } from "vitest";
import { exportBounds, fileNameFromBrief } from "./exportBoard";

describe("fileNameFromBrief", () => {
  it("slugs the brief and falls back when empty", () => {
    expect(fileNameFromBrief("Grocery checkout: cart, address")).toBe("cocanvas-grocery-checkout-cart-address.png");
    expect(fileNameFromBrief("   ")).toBe("cocanvas.png");
  });
});

describe("exportBounds", () => {
  it("pads around the nodes and uses a fallback when empty", () => {
    expect(exportBounds([])).toEqual({ x: 0, y: 0, width: 800, height: 500 });
    expect(exportBounds([{ x: 100, y: 40, width: 80, height: 50 }])).toEqual({
      x: 52,
      y: -8,
      width: 176,
      height: 146,
    });
  });
});

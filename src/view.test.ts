import { describe, expect, it } from "vitest";
import { clampZoom, nudgeZoom, scrollAfterZoom, surfaceZoom } from "./view";

describe("zoom", () => {
  it("clamps and snaps to 5 percent steps", () => {
    expect(clampZoom(0.1)).toBe(0.4);
    expect(clampZoom(4)).toBe(2.5);
    expect(clampZoom(1.12)).toBe(1.1);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("steps by a tenth", () => {
    expect(nudgeZoom(1, 1)).toBe(1.1);
    expect(nudgeZoom(1, -1)).toBe(0.9);
    expect(nudgeZoom(0.4, -1)).toBe(0.4);
  });

  it("reads zoom from the surface", () => {
    const el = document.createElement("div");
    expect(surfaceZoom(el)).toBe(1);
    el.dataset.zoom = "1.5";
    expect(surfaceZoom(el)).toBe(1.5);
  });

  it("keeps the board point under the cursor when zooming", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollLeft", { value: 0, writable: true });
    Object.defineProperty(el, "scrollTop", { value: 0, writable: true });
    el.getBoundingClientRect = () =>
      ({ left: 100, top: 50, right: 500, bottom: 350, width: 400, height: 300, x: 100, y: 50, toJSON() {} }) as DOMRect;
    scrollAfterZoom(el, 1, 2, 300, 200);
    expect(el.scrollLeft).toBe(200);
    expect(el.scrollTop).toBe(150);
  });
});

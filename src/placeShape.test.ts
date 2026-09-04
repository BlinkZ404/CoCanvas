import { describe, expect, it } from "vitest";
import { boardPointFromClient, clientHitsSurface, isShapeKind, placeShapeAt } from "./placeShape";
import { useCanvasStore } from "./store/canvasStore";

describe("isShapeKind", () => {
  it("accepts insertable kinds only", () => {
    expect(isShapeKind("rectangle")).toBe(true);
    expect(isShapeKind("connector")).toBe(false);
  });
});

describe("placeShapeAt", () => {
  it("returns null when there is no board", () => {
    expect(placeShapeAt("rectangle", 10, 10)).toBeNull();
  });

  it("returns null when the pointer is outside the board", () => {
    const surface = document.createElement("div");
    surface.className = "canvas-surface";
    surface.getBoundingClientRect = () =>
      ({ left: 100, top: 50, right: 500, bottom: 400, width: 400, height: 350, x: 100, y: 50, toJSON() {} }) as DOMRect;
    document.body.append(surface);
    expect(placeShapeAt("rectangle", 10, 10)).toBeNull();
  });

  it("adds a centered rectangle when the pointer is on the board", () => {
    const surface = document.createElement("div");
    surface.className = "canvas-surface";
    surface.getBoundingClientRect = () =>
      ({ left: 100, top: 50, right: 500, bottom: 400, width: 400, height: 350, x: 100, y: 50, toJSON() {} }) as DOMRect;
    document.body.append(surface);

    const el = placeShapeAt("rectangle", 200, 150);
    expect(el?.kind).toBe("rectangle");
    expect(useCanvasStore.getState().selectedId).toBe(el?.id);
    expect(el && el.x >= 0 && el.y >= 0).toBe(true);
  });
});

describe("clientHitsSurface", () => {
  it("is true only inside the surface box", () => {
    const surface = {
      getBoundingClientRect: () => ({ left: 100, top: 50, right: 500, bottom: 400 }),
    } as HTMLElement;
    expect(clientHitsSurface(surface, 200, 150)).toBe(true);
    expect(clientHitsSurface(surface, 10, 10)).toBe(false);
  });
});

describe("boardPointFromClient", () => {
  it("maps client pixels onto the scrolled board", () => {
    const surface = {
      getBoundingClientRect: () => ({ left: 100, top: 50 }),
      scrollLeft: 40,
      scrollTop: 20,
    } as HTMLElement;
    expect(boardPointFromClient(surface, 200, 150)).toEqual({ x: 140, y: 120 });
  });

  it("divides by the surface zoom", () => {
    const surface = {
      getBoundingClientRect: () => ({ left: 100, top: 50 }),
      scrollLeft: 40,
      scrollTop: 20,
      dataset: { zoom: "2" },
    } as unknown as HTMLElement;
    expect(boardPointFromClient(surface, 200, 150)).toEqual({ x: 70, y: 60 });
  });
});

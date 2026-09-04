import { describe, expect, it, vi } from "vitest";
import { BOARD_PAD, MIN_NODE_H, MIN_NODE_W, boardExtent, boxesOverlap, resizeByHandle, scrollBoardFromPointer } from "./board";

describe("boardExtent", () => {
  it("returns null when the board is empty", () => {
    expect(boardExtent([])).toBeNull();
  });

  it("pads past the farthest node", () => {
    expect(
      boardExtent([
        { x: 10, y: 20, width: 100, height: 40 },
        { x: 200, y: 80, width: 50, height: 30 },
      ])
    ).toEqual({ width: 250 + BOARD_PAD, height: 110 + BOARD_PAD });
  });
});

describe("boxesOverlap", () => {
  it("detects overlapping boxes and misses a gap", () => {
    expect(boxesOverlap({ x: 0, y: 0, width: 40, height: 40 }, { x: 20, y: 20, width: 40, height: 40 })).toBe(true);
    expect(boxesOverlap({ x: 0, y: 0, width: 40, height: 40 }, { x: 50, y: 0, width: 40, height: 40 })).toBe(false);
  });
});

describe("resizeByHandle", () => {
  const start = { x: 100, y: 80, w: 160, h: 80 };

  it("grows the east edge and keeps x", () => {
    expect(resizeByHandle(start, "e", 40, 0)).toEqual({ x: 100, y: 80, width: 200, height: 80 });
  });

  it("keeps the east edge when dragging west", () => {
    const next = resizeByHandle(start, "w", 40, 0);
    expect(next.x + next.width).toBe(260);
    expect(next.x).toBe(140);
    expect(next.width).toBe(120);
  });

  it("does not move x below 0 when dragging west past the origin", () => {
    const next = resizeByHandle(start, "w", -200, 0);
    expect(next.x).toBe(0);
    expect(next.width).toBe(260);
  });

  it("clamps to the minimum size from the east", () => {
    expect(resizeByHandle(start, "e", -400, 0).width).toBe(MIN_NODE_W);
  });

  it("keeps the south edge when dragging north", () => {
    const next = resizeByHandle(start, "n", 0, 20);
    expect(next.y + next.height).toBe(160);
    expect(next.y).toBe(100);
  });

  it("clamps to the minimum height from the south", () => {
    expect(resizeByHandle(start, "s", 0, -400).height).toBe(MIN_NODE_H);
  });

  it("resizes a corner on both axes", () => {
    const next = resizeByHandle(start, "se", 20, 10);
    expect(next).toEqual({ x: 100, y: 80, width: 180, height: 90 });
  });
});

describe("scrollBoardFromPointer", () => {
  function surface(rect: Partial<DOMRect>, scrollBy = vi.fn()) {
    return {
      getBoundingClientRect: () =>
        ({ left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300, x: 0, y: 0, ...rect, toJSON() {} }) as DOMRect,
      scrollBy,
    } as unknown as HTMLElement;
  }

  it("scrolls right when the pointer is on the east edge", () => {
    const scrollBy = vi.fn();
    const el = surface({}, scrollBy);
    scrollBoardFromPointer(el, 390, 150);
    expect(scrollBy).toHaveBeenCalledWith(18, 0);
  });

  it("does not scroll when the pointer is in the middle", () => {
    const scrollBy = vi.fn();
    scrollBoardFromPointer(surface({}, scrollBy), 200, 150);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});

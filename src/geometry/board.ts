export const MIN_NODE_W = 56;
export const MIN_NODE_H = 36;
export const BOARD_PAD = 64;

export type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export function resizeByHandle(
  start: { x: number; y: number; w: number; h: number },
  handle: ResizeHandle,
  dx: number,
  dy: number
) {
  const east = handle === "e" || handle === "ne" || handle === "se";
  const west = handle === "w" || handle === "nw" || handle === "sw";
  const north = handle === "n" || handle === "nw" || handle === "ne";
  const south = handle === "s" || handle === "sw" || handle === "se";
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  let x = start.x;
  let y = start.y;
  let w = start.w;
  let h = start.h;
  if (east) w = Math.max(MIN_NODE_W, start.w + dx);
  if (west) {
    x = Math.min(right - MIN_NODE_W, Math.max(0, start.x + dx));
    w = right - x;
  }
  if (south) h = Math.max(MIN_NODE_H, start.h + dy);
  if (north) {
    y = Math.min(bottom - MIN_NODE_H, Math.max(0, start.y + dy));
    h = bottom - y;
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(w),
    height: Math.round(h),
  };
}

export function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function boardExtent(elements: Array<{ x: number; y: number; width: number; height: number }>) {
  let width = 0;
  let height = 0;
  for (const el of elements) {
    width = Math.max(width, el.x + el.width);
    height = Math.max(height, el.y + el.height);
  }
  if (!width && !height) return null;
  return { width: width + BOARD_PAD, height: height + BOARD_PAD };
}

export function scrollBoardFromPointer(surface: HTMLElement, clientX: number, clientY: number) {
  const rect = surface.getBoundingClientRect();
  const margin = 36;
  let x = 0;
  let y = 0;
  if (clientX > rect.right - margin) x = 18;
  else if (clientX < rect.left + margin) x = -18;
  if (clientY > rect.bottom - margin) y = 18;
  else if (clientY < rect.top + margin) y = -18;
  if (x || y) surface.scrollBy(x, y);
}

import type { CanvasElement } from "../types";

type Pt = { x: number; y: number };
type Side = "n" | "e" | "s" | "w";

const PAD = 10;
const STUB = 14;

export interface ConnectorLayout {
  d: string;
  labelX: number;
  labelY: number;
  length: number;
}

export function connectorLabelBox(label: string, geo: Pick<ConnectorLayout, "labelX" | "labelY">) {
  const width = Math.max(32, label.length * 7.2 + 16);
  return { x: geo.labelX - width / 2, y: geo.labelY - 11, width, height: 18 };
}

function center(el: CanvasElement): Pt {
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
}

function clamp(n: number, lo: number, hi: number) {
  if (hi < lo) return (lo + hi) / 2;
  return Math.min(hi, Math.max(lo, n));
}

function facing(from: CanvasElement, to: CanvasElement): [Side, Side] {
  const stackedBelow = to.y >= from.y + from.height - 4;
  const stackedAbove = from.y >= to.y + to.height - 4;
  if (stackedBelow) return ["s", "n"];
  if (stackedAbove) return ["n", "s"];
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? ["e", "w"] : ["w", "e"];
  }
  return dy >= 0 ? ["s", "n"] : ["n", "s"];
}

function rangeY(el: CanvasElement): [number, number] {
  return [el.y + PAD, el.y + el.height - PAD];
}

function rangeX(el: CanvasElement): [number, number] {
  return [el.x + PAD, el.x + el.width - PAD];
}

/** X on an ellipse at a given Y, on the east or west rim. */
function ellipseXAtY(el: CanvasElement, y: number, side: "e" | "w") {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const rx = Math.max(1, el.width / 2);
  const ry = Math.max(1, el.height / 2);
  const t = clamp((y - cy) / ry, -1, 1);
  const k = Math.sqrt(Math.max(0, 1 - t * t));
  return side === "e" ? cx + rx * k : cx - rx * k;
}

/** Y on an ellipse at a given X, on the north or south rim. */
function ellipseYAtX(el: CanvasElement, x: number, side: "n" | "s") {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const rx = Math.max(1, el.width / 2);
  const ry = Math.max(1, el.height / 2);
  const t = clamp((x - cx) / rx, -1, 1);
  const k = Math.sqrt(Math.max(0, 1 - t * t));
  return side === "s" ? cy + ry * k : cy - ry * k;
}

function portX(el: CanvasElement, y: number, side: "e" | "w") {
  if (el.kind === "ellipse") return ellipseXAtY(el, y, side);
  return side === "e" ? el.x + el.width : el.x;
}

function portY(el: CanvasElement, x: number, side: "n" | "s") {
  if (el.kind === "ellipse") return ellipseYAtX(el, x, side);
  return side === "s" ? el.y + el.height : el.y;
}

function overlap(a0: number, a1: number, b0: number, b1: number) {
  const lo = Math.max(a0, b0);
  const hi = Math.min(a1, b1);
  return hi >= lo ? ([lo, hi] as const) : null;
}

function polyline(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function longestMid(pts: Pt[]): Pt {
  let best = 0;
  let mid: Pt = pts[0];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len >= best) {
      best = len;
      mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return mid;
}

function lengthOf(pts: Pt[]) {
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    n += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  return n;
}

function laidOut(pts: Pt[], dx: number, dy: number): ConnectorLayout {
  const mid = longestMid(pts);
  return { d: polyline(pts), labelX: mid.x + dx, labelY: mid.y + dy, length: lengthOf(pts) };
}

/** Straight edge when nodes share a band; otherwise an orthogonal elbow. */
export function connectorLayout(from: CanvasElement, to: CanvasElement): ConnectorLayout {
  const [fromSide, toSide] = facing(from, to);
  const horizontal = fromSide === "e" || fromSide === "w";

  if (horizontal) {
    const [fy0, fy1] = rangeY(from);
    const [ty0, ty1] = rangeY(to);
    const band = overlap(fy0, fy1, ty0, ty1);
    const ay = band ? (band[0] + band[1]) / 2 : clamp(center(from).y, fy0, fy1);
    const by = band ? ay : clamp(center(to).y, ty0, ty1);
    const a: Pt = { x: portX(from, ay, fromSide as "e" | "w"), y: ay };
    const b: Pt = { x: portX(to, by, toSide as "e" | "w"), y: by };
    if (band) return laidOut([a, b], 0, -12);
    const midX = (a.x + b.x) / 2;
    const out = fromSide === "e" ? Math.max(a.x + STUB, midX) : Math.min(a.x - STUB, midX);
    const inn = toSide === "w" ? Math.min(b.x - STUB, midX) : Math.max(b.x + STUB, midX);
    const spine = (out + inn) / 2;
    return laidOut([a, { x: spine, y: a.y }, { x: spine, y: b.y }, b], 0, -12);
  }

  const [fx0, fx1] = rangeX(from);
  const [tx0, tx1] = rangeX(to);
  const band = overlap(fx0, fx1, tx0, tx1);
  const ax = band ? (band[0] + band[1]) / 2 : clamp(center(to).x, fx0, fx1);
  const bx = band ? ax : clamp(center(to).x, tx0, tx1);
  const a: Pt = { x: ax, y: portY(from, ax, fromSide as "n" | "s") };
  const b: Pt = { x: bx, y: portY(to, bx, toSide as "n" | "s") };
  if (band) return laidOut([a, b], 12, 0);
  const midY = (a.y + b.y) / 2;
  const out = fromSide === "s" ? Math.max(a.y + STUB, midY) : Math.min(a.y - STUB, midY);
  const inn = toSide === "n" ? Math.min(b.y - STUB, midY) : Math.max(b.y + STUB, midY);
  const spine = (out + inn) / 2;
  return laidOut([a, { x: a.x, y: spine }, { x: b.x, y: spine }, b], 0, -12);
}

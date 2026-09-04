import { rectangleRole } from "./design";
import { connectorLayout } from "./geometry/connectors";
import { stackHeading } from "./labels";
import { isDarkColor } from "./theme";
import type { CanvasElement, Connector } from "./types";

const PAD = 48;
const FONT = 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif';

export interface ExportBoard {
  elements: CanvasElement[];
  connectors: Connector[];
  background: string;
  brief: string;
}

export function fileNameFromBrief(brief: string) {
  const slug = brief
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug ? `cocanvas-${slug}.png` : "cocanvas.png";
}

export function exportBounds(elements: Array<{ x: number; y: number; width: number; height: number }>) {
  if (elements.length === 0) {
    return { x: 0, y: 0, width: 800, height: 500 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return {
    x: minX - PAD,
    y: minY - PAD,
    width: maxX - minX + PAD * 2,
    height: maxY - minY + PAD * 2,
  };
}

export async function renderBoardPng(board: ExportBoard): Promise<Blob> {
  const box = exportBounds(board.elements);
  const scale = Math.min(2, 4096 / Math.max(box.width, 1), 4096 / Math.max(box.height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(box.width * scale));
  canvas.height = Math.max(1, Math.round(box.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the board.");
  ctx.scale(scale, scale);
  ctx.translate(-box.x, -box.y);
  ctx.fillStyle = board.background || "#f6f4ef";
  ctx.fillRect(box.x, box.y, box.width, box.height);

  const byId = new Map(board.elements.map((el) => [el.id, el]));
  const dark = isDarkColor(board.background);
  const line = dark ? "#c3cad6" : "#7b8494";
  const labelFill = dark ? "#2a2e36" : "#f6f4ef";
  const labelStroke = dark ? "#6b7280" : "#d8d3c8";

  for (const conn of board.connectors) {
    const from = byId.get(conn.from);
    const to = byId.get(conn.to);
    if (!from || !to) continue;
    const geo = connectorLayout(from, to);
    const pts = pathPoints(geo.d);
    if (pts.length < 2) continue;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    drawArrow(ctx, pts[pts.length - 2], pts[pts.length - 1], line);
    if (conn.label && geo.length >= 44) {
      const labelW = Math.max(32, conn.label.length * 7.2 + 16);
      roundRect(ctx, geo.labelX - labelW / 2, geo.labelY - 11, labelW, 18, 9);
      ctx.fillStyle = labelFill;
      ctx.fill();
      ctx.strokeStyle = labelStroke;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = dark ? "#e6e8ee" : "#3a3e46";
      ctx.font = `600 11px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(conn.label, geo.labelX, geo.labelY);
    }
  }

  const ordered = [...board.elements].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
  for (const el of ordered) drawNode(ctx, el);

  return canvasToBlob(canvas);
}

export async function downloadBoardPng(board: ExportBoard) {
  const blob = await renderBoardPng(board);
  const name = fileNameFromBrief(board.brief);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return name;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode the PNG."));
    }, "image/png");
  });
}

function pathPoints(d: string) {
  return [...d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - 10 * Math.cos(angle - 0.4), to.y - 10 * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - 10 * Math.cos(angle + 0.4), to.y - 10 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

function drawNode(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  const role = rectangleRole(el);
  const r =
    el.kind === "ellipse"
      ? Math.min(el.width, el.height) / 2
      : el.kind === "text" || role === "rule" || role === "row"
        ? 0
        : role === "bar"
          ? 8
          : 6;
  if (el.kind !== "text") {
    if (el.kind === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
    } else {
      roundRect(ctx, el.x, el.y, el.width, el.height, r);
    }
    ctx.fillStyle = el.fill;
    ctx.fill();
    if (el.stroke && el.stroke !== "transparent") {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  const text = el.text.trim();
  if (!text) return;
  ctx.fillStyle = el.kind === "text" ? el.fill : el.kind === "frame" || el.kind === "sticky" ? "#1a1a1e" : contrast(el.fill);
  ctx.font = `${el.kind === "text" ? 500 : 600} ${el.fontSize}px ${FONT}`;
  ctx.textBaseline = "middle";

  if (el.kind === "frame") {
    ctx.textAlign = "left";
    ctx.fillText(clipLine(ctx, text, el.width - 24), el.x + 12, el.y + 16);
    return;
  }
  if (el.kind === "text" || el.kind === "sticky") {
    ctx.textAlign = "left";
    const lines = wrapText(ctx, text, el.width - 24);
    const lineH = el.fontSize * 1.25;
    let y = el.y + 16;
    for (const line of lines) {
      if (y > el.y + el.height - 8) break;
      ctx.fillText(line, el.x + 12, y);
      y += lineH;
    }
    return;
  }
  ctx.textAlign = "center";
  const lines = wrapText(ctx, text, el.width - 24);
  const lineH = el.fontSize * 1.2;
  const total = lines.length * lineH;
  let y = el.y + el.height / 2 - total / 2 + lineH / 2;
  for (const line of lines) {
    ctx.fillText(line, el.x + el.width / 2, y);
    y += lineH;
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const para of stackHeading(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = `${line} ${words[i]}`;
      if (ctx.measureText(next).width <= maxWidth) line = next;
      else {
        lines.push(line);
        line = words[i];
      }
    }
    lines.push(line);
  }
  return lines;
}

function clipLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}...`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}...`;
}

function contrast(hex: string) {
  const n = hex.replace("#", "");
  if (n.length !== 6) return "#fff";
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.62 ? "#1a1a1e" : "#fff";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

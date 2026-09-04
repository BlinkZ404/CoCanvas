import { readThemePref, resolveTheme, stockBoardForTheme } from "../theme";
import type { CanvasState } from "../store/canvasStore";
import type { ElementKind } from "../types";

type Board = Pick<CanvasState, "addElement" | "setBackground" | "connect">;

type PartialEl = {
  kind: ElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fill: string;
  stroke?: string;
  fontSize?: number;
};

type Role = "start" | "end" | "step" | "field" | "button" | "ghost";

function add(s: Board, partial: PartialEl) {
  return s.addElement(partial, "agent");
}

function titleFromBrief(brief: string) {
  const first = brief.split(/[:\n]/)[0]?.trim() ?? "";
  return first.replace(/\.$/, "").slice(0, 44) || "Flow";
}

/** Split a brief into labels. Keeps version dots like 5.1. */
export function briefPhrases(brief: string): string[] {
  const parts = brief
    .split(/[,;:]/)
    .map((s) => s.replace(/\.\s+[A-Z].*$/, "").replace(/\.$/, "").trim())
    .filter((s) => s.length >= 2);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  return unique;
}

function roleFor(label: string, index: number, count: number): Role {
  const t = label.toLowerCase();
  if (/(email|password|field|address|search)/.test(t)) return "field";
  if (/(continue|sign|submit|pay|send|create)/.test(t)) return "button";
  if (/(google|apple|microsoft|github|\bor\b)/.test(t)) return "ghost";
  if (index === 0) return "start";
  if (index === count - 1) return "end";
  return "step";
}

function chrome(role: Role, dark: boolean) {
  if (role === "field") {
    return { kind: "rectangle" as const, fill: dark ? "#1c1f26" : "#ffffff", stroke: dark ? "#5c6472" : "#c5c5c5" };
  }
  if (role === "button") {
    return { kind: "rectangle" as const, fill: dark ? "#e6e8ee" : "#17181c", stroke: dark ? "#e6e8ee" : "#17181c" };
  }
  if (role === "ghost") {
    return { kind: "rectangle" as const, fill: dark ? "#2c3039" : "#ffffff", stroke: dark ? "#7d8696" : "#c5c5c5" };
  }
  if (role === "start") {
    return { kind: "ellipse" as const, fill: "#2f9a6a", stroke: "#21724d" };
  }
  if (role === "end") {
    return { kind: "ellipse" as const, fill: "#c46b5d", stroke: "#9a5248" };
  }
  return { kind: "rectangle" as const, fill: "#4f6f9a", stroke: "#3a5478" };
}

function looksLikeScreen(brief: string) {
  return /(log ?in|sign ?in|welcome back|email address|continue with)/i.test(brief);
}

function looksLikeRanking(brief: string) {
  return /(rank|frontier|leaderboard|scoreboard)/i.test(brief);
}

/** Place a connected sketch from the brief. Labels come from the brief, not a named template. */
export function sketchFromBrief(brief: string, s: Board): string[] {
  const dark = resolveTheme(readThemePref()) === "dark";
  const ink = dark ? "#e6e8ee" : "#17181c";
  const muted = dark ? "#9aa1ad" : "#5c6472";
  const title = titleFromBrief(brief);
  const phrases = briefPhrases(brief).filter((p) => p.toLowerCase() !== title.toLowerCase());
  const steps = phrases.length ? phrases.slice(0, 8) : ["Start", "Next", "End"];
  const ids: string[] = [];

  s.setBackground(stockBoardForTheme(dark ? "dark" : "light"), "agent");
  ids.push(
    add(s, {
      kind: "text",
      x: 48,
      y: 36,
      width: 640,
      height: 36,
      text: title,
      fill: ink,
      fontSize: 24,
    }).id
  );

  if (looksLikeRanking(brief)) {
    steps.forEach((label, i) => {
      const y = 100 + i * 72;
      const tone = chrome(i === 0 ? "start" : i === steps.length - 1 ? "end" : "step", dark);
      ids.push(
        add(s, {
          kind: "ellipse",
          x: 48,
          y: y + 8,
          width: 48,
          height: 48,
          text: String(i + 1),
          fill: tone.fill,
          stroke: tone.stroke,
          fontSize: 16,
        }).id
      );
      ids.push(
        add(s, {
          kind: "rectangle",
          x: 112,
          y,
          width: 420,
          height: 64,
          text: label,
          fill: tone.fill,
          stroke: tone.stroke,
          fontSize: 15,
        }).id
      );
    });
    return ids;
  }

  if (looksLikeScreen(brief)) {
    const x = 200;
    const w = 360;
    let y = 100;
    steps.forEach((label, i) => {
      const role = roleFor(label, i, steps.length);
      if (role === "start" || /welcome|log in to/i.test(label)) {
        ids.push(
          add(s, {
            kind: "text",
            x,
            y,
            width: w,
            height: 36,
            text: label,
            fill: ink,
            fontSize: 22,
          }).id
        );
        y += 44;
        return;
      }
      const tone = chrome(role, dark);
      const h = 48;
      ids.push(
        add(s, {
          kind: tone.kind,
          x,
          y,
          width: w,
          height: h,
          text: label,
          fill: tone.fill,
          stroke: tone.stroke,
          fontSize: role === "button" ? 15 : 14,
        }).id
      );
      y += h + (role === "ghost" ? 12 : 16);
    });
    return ids;
  }

  ids.push(
    add(s, {
      kind: "text",
      x: 48,
      y: 76,
      width: 640,
      height: 22,
      text: "Draft from the brief. Edit, then review.",
      fill: muted,
      fontSize: 13,
    }).id
  );

  const placed: string[] = [];
  steps.forEach((label, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const role = roleFor(label, i, steps.length);
    const tone = chrome(role === "field" || role === "button" || role === "ghost" ? "step" : role, dark);
    const node = add(s, {
      kind: tone.kind,
      x: 48 + col * 200,
      y: 124 + row * 140,
      width: tone.kind === "ellipse" ? 156 : 168,
      height: tone.kind === "ellipse" ? 84 : 72,
      text: label,
      fill: tone.fill,
      stroke: tone.stroke,
      fontSize: 14,
    });
    ids.push(node.id);
    placed.push(node.id);
  });

  for (let i = 0; i < placed.length - 1; i++) {
    s.connect(placed[i], placed[i + 1], i === placed.length - 2 ? "done" : "next", "agent");
  }
  return ids;
}

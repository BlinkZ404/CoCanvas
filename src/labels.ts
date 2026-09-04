import type { CanvasElement, Connector, ElementKind } from "./types";

export const KIND_LABEL: Record<ElementKind, string> = {
  frame: "Frame",
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  text: "Text",
  sticky: "Sticky note",
};

export type LayerAction = "front" | "back" | "forward" | "backward";
export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

/** ASCII copy. No em dash, en dash, or curly quotes. */
export function plainCopy(text: string): string {
  return text
    .replace(/[\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...");
}

function isKicker(word: string): boolean {
  const bare = word.replace(/[.:]+$/g, "");
  return /^[A-Z][A-Z0-9&/-]{0,20}$/.test(bare);
}

/** Put an ALL-CAPS heading on its own line. WHO GETS IT / Plus. Pro. */
export function stackHeading(text: string): string {
  const t = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!t || t.includes("\n")) return t;
  const words = t.split(/\s+/);
  let i = 0;
  while (i < words.length && i < 4 && isKicker(words[i])) i += 1;
  if (i === 0 || i === words.length) return t;
  const detail = words.slice(i).join(" ");
  if (words.length - i < 2 && !/[.$]/.test(detail)) return t;
  return `${words.slice(0, i).join(" ")}\n${detail}`;
}

export function headingLines(text: string): { kicker: string; detail: string } {
  const stacked = stackHeading(text);
  const br = stacked.indexOf("\n");
  if (br < 0) return { kicker: "", detail: stacked };
  return { kicker: stacked.slice(0, br), detail: stacked.slice(br + 1).trim() };
}

export function boardCopy(text: string): string {
  return stackHeading(plainCopy(text));
}

export function clipLabel(text: string, n = 32): string {
  const t = plainCopy(text).replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}...` : t;
}

export function elementName(el: Pick<CanvasElement, "kind" | "text">): string {
  const text = el.text.trim();
  if (text) return `"${clipLabel(text)}"`;
  const word = KIND_LABEL[el.kind].toLowerCase();
  return `${/^[aeiou]/.test(word) ? "an" : "a"} ${word}`;
}

export function connectorName(conn: Pick<Connector, "label">): string {
  const text = conn.label.trim();
  if (text) return `"${clipLabel(text)}"`;
  return "a connector";
}

export function itemName(
  s: { elements: CanvasElement[]; connectors: Connector[] },
  id: string
): string {
  const el = s.elements.find((e) => e.id === id);
  if (el) return elementName(el);
  const conn = s.connectors.find((c) => c.id === id);
  if (conn) return connectorName(conn);
  return "that item";
}

export function kindWord(kind: string): string {
  return KIND_LABEL[kind as ElementKind] ?? kind;
}

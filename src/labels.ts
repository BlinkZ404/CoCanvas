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

export function clipLabel(text: string, n = 32): string {
  const t = text.trim();
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

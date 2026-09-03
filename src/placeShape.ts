import { useCanvasStore } from "./store/canvasStore";
import type { ElementKind } from "./types";

export const SHAPE_KINDS: ElementKind[] = ["frame", "rectangle", "ellipse", "text", "sticky"];

export function isShapeKind(value: string): value is ElementKind {
  return SHAPE_KINDS.includes(value as ElementKind);
}

export function boardPointFromClient(surface: HTMLElement, clientX: number, clientY: number) {
  const rect = surface.getBoundingClientRect();
  return {
    x: clientX - rect.left + surface.scrollLeft,
    y: clientY - rect.top + surface.scrollTop,
  };
}

export function clientHitsSurface(
  surface: Pick<Element, "getBoundingClientRect">,
  clientX: number,
  clientY: number
) {
  const rect = surface.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

export function placeShapeAt(kind: ElementKind, clientX: number, clientY: number) {
  const surface = document.querySelector<HTMLElement>(".canvas-surface");
  if (!surface || !clientHitsSurface(surface, clientX, clientY)) return null;
  const { x, y } = boardPointFromClient(surface, clientX, clientY);
  const el = useCanvasStore.getState().addElement({ kind, x: Math.max(0, x), y: Math.max(0, y) }, "human");
  const nx = Math.max(0, Math.round(x - el.width / 2));
  const ny = Math.max(0, Math.round(y - el.height / 2));
  if (nx !== el.x || ny !== el.y) {
    useCanvasStore.getState().updateElement(el.id, { x: nx, y: ny }, "human", {
      log: false,
      undo: false,
    });
  }
  return el;
}

import type { CanvasElement } from "../types";

export function box(partial: Partial<CanvasElement> & Pick<CanvasElement, "id">): CanvasElement {
  return {
    kind: "rectangle",
    x: 0,
    y: 0,
    width: 160,
    height: 80,
    text: "",
    fill: "#5b7fb5",
    stroke: "#3f5d88",
    fontSize: 14,
    z: 0,
    ...partial,
  };
}

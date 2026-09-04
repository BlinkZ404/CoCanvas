export type ElementKind = "frame" | "rectangle" | "ellipse" | "text" | "sticky";

export interface CanvasElement {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  /** For text elements this is the ink color, not a fill. */
  fill: string;
  stroke: string;
  fontSize: number;
  z: number;
}

export interface Connector {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface Activity {
  id: string;
  actor: "human" | "agent";
  message: string;
  at: number;
}

export interface Pin {
  id: string;
  elementId: string;
  actor: "human" | "agent";
  text: string;
  resolved: boolean;
}

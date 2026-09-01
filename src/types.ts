export type ElementKind = "frame" | "rectangle" | "ellipse" | "text" | "sticky";

export interface CanvasElement {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Text content for text / sticky / frame-title elements. */
  text: string;
  /** Fill color (hex). For text elements this is the text color. */
  fill: string;
  /** Stroke / border color (hex). */
  stroke: string;
  /** Font size in px, used by text and sticky notes. */
  fontSize: number;
  /** Draw order; higher renders on top. */
  z: number;
}

export interface Connector {
  id: string;
  from: string;
  to: string;
  label: string;
}

/** An entry in the shared activity log, tagged by who performed the action. */
export interface Activity {
  id: string;
  actor: "human" | "agent";
  message: string;
  at: number;
}

/** A critique pinned to an element. Human and agent share the same pins. */
export interface Pin {
  id: string;
  elementId: string;
  actor: "human" | "agent";
  text: string;
  resolved: boolean;
}

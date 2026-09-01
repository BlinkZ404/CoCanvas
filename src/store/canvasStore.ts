import { create } from "zustand";
import type { Activity, CanvasElement, Connector, ElementKind } from "../types";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

const PALETTE = [
  "#6d74c9",
  "#c4898a",
  "#c4a35a",
  "#5a9e86",
  "#5b7fb5",
  "#c46b5d",
  "#8b7cc4",
  "#5aa8a0",
];

export interface CanvasState {
  elements: CanvasElement[];
  connectors: Connector[];
  selectedId: string | null;
  background: string;
  activity: Activity[];
  /** Bumped whenever the view should scroll back to the canvas origin. */
  resetViewNonce: number;

  addElement: (
    partial: Partial<CanvasElement> & { kind: ElementKind },
    actor?: Activity["actor"]
  ) => CanvasElement;
  updateElement: (
    id: string,
    patch: Partial<CanvasElement>,
    actor?: Activity["actor"]
  ) => CanvasElement | null;
  moveElement: (
    id: string,
    x: number,
    y: number,
    actor?: Activity["actor"]
  ) => CanvasElement | null;
  deleteElement: (id: string, actor?: Activity["actor"]) => boolean;
  select: (id: string | null, actor?: Activity["actor"]) => void;
  setBackground: (color: string, actor?: Activity["actor"]) => void;
  connect: (
    from: string,
    to: string,
    label: string,
    actor?: Activity["actor"]
  ) => Connector | null;
  clearAll: (actor?: Activity["actor"]) => void;
  arrangeGrid: (columns: number, actor?: Activity["actor"]) => number;
  resetView: () => void;
  log: (actor: Activity["actor"], message: string) => void;
}

function defaultsFor(kind: ElementKind): Omit<CanvasElement, "id" | "kind" | "z"> {
  switch (kind) {
    case "frame":
      return { x: 80, y: 80, width: 320, height: 220, text: "Frame", fill: "#fffcf7", stroke: "#d8d3c8", fontSize: 13 };
    case "rectangle":
      return { x: 120, y: 120, width: 168, height: 104, text: "", fill: "#6d74c9", stroke: "#4f5699", fontSize: 14 };
    case "ellipse":
      return { x: 120, y: 120, width: 140, height: 140, text: "", fill: "#c4898a", stroke: "#9a6a6c", fontSize: 14 };
    case "text":
      return { x: 140, y: 140, width: 220, height: 40, text: "Text", fill: "#1a1a1e", stroke: "transparent", fontSize: 22 };
    case "sticky":
      return { x: 140, y: 140, width: 180, height: 160, text: "Note", fill: "#f3e4c6", stroke: "#d4b57a", fontSize: 15 };
  }
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  elements: [],
  connectors: [],
  selectedId: null,
  background: "#f6f4ef",
  activity: [],
  resetViewNonce: 0,

  log: (actor, message) =>
    set((s) => ({
      activity: [
        { id: nextId("act"), actor, message, at: Date.now() },
        ...s.activity,
      ].slice(0, 120),
    })),

  addElement: (partial, actor = "human") => {
    const base = defaultsFor(partial.kind);
    const maxZ = get().elements.reduce((m, e) => Math.max(m, e.z), 0);
    const n = get().elements.length;
    const el: CanvasElement = {
      id: nextId(partial.kind),
      z: maxZ + 1,
      ...base,
      ...partial,
      x: partial.x ?? base.x + (n % 6) * 18,
      y: partial.y ?? base.y + (n % 6) * 18,
    };
    if (
      (partial.kind === "rectangle" || partial.kind === "ellipse") &&
      partial.fill === undefined
    ) {
      el.fill = PALETTE[get().elements.length % PALETTE.length];
    }
    set((s) => ({ elements: [...s.elements, el], selectedId: el.id }));
    get().log(actor, `added ${el.kind}${el.text ? ` "${el.text}"` : ""} (${el.id})`);
    return el;
  },

  updateElement: (id, patch, actor = "human") => {
    let updated: CanvasElement | null = null;
    set((s) => ({
      elements: s.elements.map((e) => {
        if (e.id !== id) return e;
        updated = { ...e, ...patch, id: e.id, kind: e.kind };
        return updated;
      }),
    }));
    if (updated) {
      const keys = Object.keys(patch).join(", ");
      get().log(actor, `updated ${id} (${keys})`);
    }
    return updated;
  },

  moveElement: (id, x, y, actor = "human") => {
    return get().updateElement(id, { x, y }, actor);
  },

  deleteElement: (id, actor = "human") => {
    const exists = get().elements.some((e) => e.id === id);
    if (!exists) return false;
    set((s) => ({
      elements: s.elements.filter((e) => e.id !== id),
      connectors: s.connectors.filter((c) => c.from !== id && c.to !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
    get().log(actor, `deleted ${id}`);
    return true;
  },

  select: (id, actor = "human") => {
    set({ selectedId: id });
    if (id) get().log(actor, `selected ${id}`);
  },

  setBackground: (color, actor = "human") => {
    set({ background: color });
    get().log(actor, `set canvas background to ${color}`);
  },

  connect: (from, to, label, actor = "human") => {
    const els = get().elements;
    if (!els.some((e) => e.id === from) || !els.some((e) => e.id === to)) {
      return null;
    }
    const connector: Connector = { id: nextId("conn"), from, to, label };
    set((s) => ({ connectors: [...s.connectors, connector] }));
    get().log(actor, `connected ${from} to ${to}`);
    return connector;
  },

  clearAll: (actor = "human") => {
    set((s) => ({
      elements: [],
      connectors: [],
      selectedId: null,
      resetViewNonce: s.resetViewNonce + 1,
    }));
    get().log(actor, "cleared the canvas");
  },

  resetView: () => set((s) => ({ resetViewNonce: s.resetViewNonce + 1 })),

  arrangeGrid: (columns, actor = "human") => {
    const cols = Math.max(1, Math.floor(columns));
    const gap = 32;
    const startX = 80;
    const startY = 80;
    let count = 0;
    const els = get().elements;
    const colWidth = Math.max(...els.map((e) => e.width), 120) + gap;
    const rowHeight = Math.max(...els.map((e) => e.height), 120) + gap;
    set((s) => ({
      elements: s.elements.map((e, i) => {
        count += 1;
        const col = i % cols;
        const row = Math.floor(i / cols);
        return { ...e, x: startX + col * colWidth, y: startY + row * rowHeight };
      }),
    }));
    get().log(actor, `arranged ${count} elements into a ${cols}-column grid`);
    return count;
  },
}));

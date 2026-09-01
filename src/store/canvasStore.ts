import { create } from "zustand";
import type { Activity, CanvasElement, Connector, ElementKind, Pin } from "../types";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function adoptIds(ids: string[]) {
  for (const id of ids) {
    const m = id.match(/_(\d+)$/);
    if (m) idCounter = Math.max(idCounter, Number(m[1]));
  }
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

const STORAGE_KEY = "cocanvas.board.v1";

interface Snapshot {
  elements: CanvasElement[];
  connectors: Connector[];
  selectedId: string | null;
  background: string;
  brief: string;
  pins: Pin[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface CanvasState {
  elements: CanvasElement[];
  connectors: Connector[];
  selectedId: string | null;
  background: string;
  activity: Activity[];
  brief: string;
  pins: Pin[];
  agentUndoDepth: number;
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
  setBrief: (brief: string, actor?: Activity["actor"]) => void;
  addPin: (elementId: string, text: string, actor?: Activity["actor"]) => Pin | null;
  resolvePin: (id: string, actor?: Activity["actor"]) => boolean;
  beginAgentTurn: () => void;
  beginAgentBatch: () => void;
  endAgentBatch: () => void;
  undoAgent: () => boolean;
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

const agentUndo: Snapshot[] = [];
let agentShotThisTurn = false;
let holdAgentTurn = false;

function capture(s: Pick<CanvasState, keyof Snapshot>): Snapshot {
  return clone({
    elements: s.elements,
    connectors: s.connectors,
    selectedId: s.selectedId,
    background: s.background,
    brief: s.brief,
    pins: s.pins,
  });
}

function noteAgent(get: () => CanvasState, actor: Activity["actor"]) {
  if (actor !== "agent" || agentShotThisTurn) return;
  agentUndo.push(capture(get()));
  if (agentUndo.length > 24) agentUndo.shift();
  agentShotThisTurn = true;
}

function loadPersisted(): Partial<Snapshot> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Snapshot>;
    if (!Array.isArray(data.elements)) return null;
    return data;
  } catch {
    return null;
  }
}

const persisted = loadPersisted();
if (persisted) {
  adoptIds([
    ...(persisted.elements ?? []).map((e) => e.id),
    ...(persisted.connectors ?? []).map((c) => c.id),
    ...(persisted.pins ?? []).map((p) => p.id),
  ]);
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  elements: persisted?.elements ?? [],
  connectors: persisted?.connectors ?? [],
  selectedId: persisted?.selectedId ?? null,
  background: persisted?.background ?? "#f6f4ef",
  activity: [],
  brief: persisted?.brief ?? "",
  pins: persisted?.pins ?? [],
  agentUndoDepth: 0,
  resetViewNonce: 0,

  log: (actor, message) =>
    set((s) => ({
      activity: [
        { id: nextId("act"), actor, message, at: Date.now() },
        ...s.activity,
      ].slice(0, 120),
    })),

  beginAgentTurn: () => {
    if (!holdAgentTurn) agentShotThisTurn = false;
  },

  beginAgentBatch: () => {
    agentShotThisTurn = false;
    holdAgentTurn = true;
  },

  endAgentBatch: () => {
    holdAgentTurn = false;
  },

  undoAgent: () => {
    const snap = agentUndo.pop();
    if (!snap) return false;
    set({
      elements: snap.elements,
      connectors: snap.connectors,
      selectedId: snap.selectedId,
      background: snap.background,
      brief: snap.brief,
      pins: snap.pins,
      agentUndoDepth: agentUndo.length,
    });
    get().log("human", "undid the last agent change");
    return true;
  },

  addElement: (partial, actor = "human") => {
    noteAgent(get, actor);
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
    set((s) => ({
      elements: [...s.elements, el],
      selectedId: el.id,
      agentUndoDepth: agentUndo.length,
    }));
    get().log(actor, `added ${el.kind}${el.text ? ` "${el.text}"` : ""} (${el.id})`);
    return el;
  },

  updateElement: (id, patch, actor = "human") => {
    noteAgent(get, actor);
    let updated: CanvasElement | null = null;
    set((s) => ({
      elements: s.elements.map((e) => {
        if (e.id !== id) return e;
        updated = { ...e, ...patch, id: e.id, kind: e.kind };
        return updated;
      }),
      agentUndoDepth: agentUndo.length,
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
    noteAgent(get, actor);
    set((s) => ({
      elements: s.elements.filter((e) => e.id !== id),
      connectors: s.connectors.filter((c) => c.from !== id && c.to !== id),
      pins: s.pins.filter((p) => p.elementId !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      agentUndoDepth: agentUndo.length,
    }));
    get().log(actor, `deleted ${id}`);
    return true;
  },

  select: (id, actor = "human") => {
    set({ selectedId: id });
    if (id) get().log(actor, `selected ${id}`);
  },

  setBackground: (color, actor = "human") => {
    noteAgent(get, actor);
    set({ background: color, agentUndoDepth: agentUndo.length });
    get().log(actor, `set canvas background to ${color}`);
  },

  connect: (from, to, label, actor = "human") => {
    const els = get().elements;
    if (!els.some((e) => e.id === from) || !els.some((e) => e.id === to)) {
      return null;
    }
    noteAgent(get, actor);
    const connector: Connector = { id: nextId("conn"), from, to, label };
    set((s) => ({ connectors: [...s.connectors, connector], agentUndoDepth: agentUndo.length }));
    get().log(actor, `connected ${from} to ${to}`);
    return connector;
  },

  clearAll: (actor = "human") => {
    noteAgent(get, actor);
    set((s) => ({
      elements: [],
      connectors: [],
      pins: [],
      selectedId: null,
      resetViewNonce: s.resetViewNonce + 1,
      agentUndoDepth: agentUndo.length,
    }));
    get().log(actor, "cleared the canvas");
  },

  resetView: () => set((s) => ({ resetViewNonce: s.resetViewNonce + 1 })),

  arrangeGrid: (columns, actor = "human") => {
    noteAgent(get, actor);
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
      agentUndoDepth: agentUndo.length,
    }));
    get().log(actor, `arranged ${count} elements into a ${cols}-column grid`);
    return count;
  },

  setBrief: (brief, actor = "human") => {
    noteAgent(get, actor);
    set({ brief, agentUndoDepth: agentUndo.length });
    get().log(actor, brief.trim() ? "updated the brief" : "cleared the brief");
  },

  addPin: (elementId, text, actor = "human") => {
    if (!get().elements.some((e) => e.id === elementId)) return null;
    noteAgent(get, actor);
    const pin: Pin = {
      id: nextId("pin"),
      elementId,
      actor,
      text: text.trim() || "Look here",
      resolved: false,
    };
    set((s) => ({ pins: [...s.pins, pin], selectedId: elementId, agentUndoDepth: agentUndo.length }));
    get().log(actor, `pinned ${elementId}: ${pin.text}`);
    return pin;
  },

  resolvePin: (id, actor = "human") => {
    const pin = get().pins.find((p) => p.id === id);
    if (!pin || pin.resolved) return false;
    noteAgent(get, actor);
    set((s) => ({
      pins: s.pins.map((p) => (p.id === id ? { ...p, resolved: true } : p)),
      agentUndoDepth: agentUndo.length,
    }));
    get().log(actor, `resolved pin ${id}`);
    return true;
  },
}));

if (typeof localStorage !== "undefined") {
  useCanvasStore.subscribe((s) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          elements: s.elements,
          connectors: s.connectors,
          selectedId: s.selectedId,
          background: s.background,
          brief: s.brief,
          pins: s.pins,
        })
      );
    } catch {
      // Quota or private mode. The live board still works.
    }
  });
}

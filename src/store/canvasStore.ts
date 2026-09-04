import { create } from "zustand";
import {
  boardCopy,
  elementName,
  itemName,
  plainCopy,
  type AlignEdge,
  type LayerAction,
} from "../labels";
import { MIN_NODE_H, MIN_NODE_W } from "../geometry/board";
import { LIGHT_BOARD, clearAutoBoardFrom } from "../theme";
import type { Activity, CanvasElement, Connector, ElementKind, Pin } from "../types";

export type { AlignEdge, LayerAction };

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
  "#5b7fb5",
  "#5a9e86",
  "#c46b5d",
  "#c4a35a",
  "#7a90a4",
  "#b87a6e",
  "#6b8f71",
  "#8a7b6a",
];

function sortedByZ(elements: CanvasElement[]) {
  return [...elements].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
}

function reindexZ(ordered: CanvasElement[]): CanvasElement[] {
  return ordered.map((e, i) => (e.z === i ? e : { ...e, z: i }));
}

function applyLayer(
  elements: CanvasElement[],
  id: string,
  action: LayerAction
): CanvasElement[] | null {
  const ordered = sortedByZ(elements);
  const i = ordered.findIndex((e) => e.id === id);
  if (i < 0) return null;
  const last = ordered.length - 1;
  if ((action === "front" || action === "forward") && i === last) {
    return elements;
  }
  if ((action === "back" || action === "backward") && i === 0) {
    return elements;
  }
  const next = [...ordered];
  const [item] = next.splice(i, 1);
  if (action === "front") next.push(item);
  else if (action === "back") next.unshift(item);
  else if (action === "forward") next.splice(i + 1, 0, item);
  else next.splice(Math.max(0, i - 1), 0, item);
  return reindexZ(next);
}

function contains(outer: CanvasElement, inner: CanvasElement) {
  return (
    inner.x >= outer.x - 4 &&
    inner.y >= outer.y - 4 &&
    inner.x + inner.width <= outer.x + outer.width + 4 &&
    inner.y + inner.height <= outer.y + outer.height + 4
  );
}

function alignBox(el: CanvasElement, elements: CanvasElement[]) {
  const frames = elements
    .filter((f) => f.kind === "frame" && f.id !== el.id && contains(f, el))
    .sort((a, b) => a.z - b.z);
  const parent = frames[frames.length - 1];
  if (parent) {
    return { x: parent.x, y: parent.y, width: parent.width, height: parent.height, padX: 16, padY: 36 };
  }
  return { x: 40, y: 40, width: 880, height: 560, padX: 0, padY: 0 };
}

const LAYER_LOG: Record<LayerAction, (name: string) => string> = {
  front: (name) => `brought ${name} to the front`,
  back: (name) => `sent ${name} to the back`,
  forward: (name) => `moved ${name} forward`,
  backward: (name) => `moved ${name} backward`,
};

const ALIGN_LOG: Record<AlignEdge, string> = {
  left: "left",
  center: "center",
  right: "right",
  top: "top",
  middle: "middle",
  bottom: "bottom",
};

export const STORAGE_KEY = "cocanvas.board.v1";

const KINDS: ElementKind[] = ["frame", "rectangle", "ellipse", "text", "sticky"];

function finite(n: unknown, fallback: number) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function clampPos(n: unknown, fallback = 0) {
  return Math.max(0, Math.round(finite(n, fallback)));
}

function clampW(n: unknown, fallback = MIN_NODE_W) {
  return Math.max(MIN_NODE_W, Math.round(finite(n, fallback)));
}

function clampH(n: unknown, fallback = MIN_NODE_H) {
  const value = Math.round(finite(n, fallback));
  if (value > 0 && value <= 4) return value;
  return Math.max(MIN_NODE_H, value);
}

function clampFont(n: unknown, fallback = 14) {
  return Math.max(10, Math.min(64, Math.round(finite(n, fallback))));
}

function sameElement(a: CanvasElement, b: CanvasElement) {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.text === b.text &&
    a.fill === b.fill &&
    a.stroke === b.stroke &&
    a.fontSize === b.fontSize &&
    a.z === b.z
  );
}

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
  selectedIds: string[];
  background: string;
  activity: Activity[];
  brief: string;
  pins: Pin[];
  undoDepth: number;
  redoDepth: number;
  /** Bumped whenever the view should scroll back to the canvas origin. */
  resetViewNonce: number;
  /** Two-click connect: human picks start, then end. */
  connectArmed: boolean;
  connectFromId: string | null;

  addElement: (
    partial: Partial<CanvasElement> & { kind: ElementKind },
    actor?: Activity["actor"],
    opts?: { log?: boolean; undo?: boolean }
  ) => CanvasElement;
  updateElement: (
    id: string,
    patch: Partial<CanvasElement>,
    actor?: Activity["actor"],
    opts?: { log?: boolean; undo?: boolean }
  ) => CanvasElement | null;
  moveElement: (
    id: string,
    x: number,
    y: number,
    actor?: Activity["actor"],
    opts?: { log?: boolean; undo?: boolean }
  ) => CanvasElement | null;
  layerElement: (
    id: string,
    action: LayerAction,
    actor?: Activity["actor"]
  ) => CanvasElement | null;
  duplicateElement: (id: string, actor?: Activity["actor"]) => CanvasElement | null;
  alignElement: (
    id: string,
    edge: AlignEdge,
    actor?: Activity["actor"]
  ) => CanvasElement | null;
  nudgeElement: (
    id: string,
    dx: number,
    dy: number,
    actor?: Activity["actor"],
    opts?: { log?: boolean; undo?: boolean }
  ) => CanvasElement | null;
  deleteElement: (id: string, actor?: Activity["actor"]) => boolean;
  deleteElements: (ids: string[], actor?: Activity["actor"]) => number;
  deleteConnector: (id: string, actor?: Activity["actor"]) => boolean;
  updateConnector: (
    id: string,
    patch: Partial<Pick<Connector, "label">>,
    actor?: Activity["actor"],
    opts?: { log?: boolean; undo?: boolean }
  ) => Connector | null;
  reverseConnector: (id: string, actor?: Activity["actor"]) => Connector | null;
  select: (id: string | null, actor?: Activity["actor"], opts?: { additive?: boolean }) => void;
  selectMany: (ids: string[]) => void;
  setBackground: (
    color: string,
    actor?: Activity["actor"],
    opts?: { log?: boolean; undo?: boolean; themeSync?: boolean }
  ) => void;
  connect: (
    from: string,
    to: string,
    label: string,
    actor?: Activity["actor"]
  ) => Connector | null;
  clearAll: (actor?: Activity["actor"]) => void;
  arrangeGrid: (columns: number, actor?: Activity["actor"]) => number;
  setBrief: (brief: string, actor?: Activity["actor"], opts?: { log?: boolean; undo?: boolean }) => void;
  addPin: (elementId: string, text: string, actor?: Activity["actor"]) => Pin | null;
  resolvePin: (id: string, actor?: Activity["actor"]) => boolean;
  beginAgentTurn: () => void;
  beginAgentBatch: () => void;
  endAgentBatch: () => void;
  beginGesture: () => void;
  endGesture: () => void;
  undo: (actor?: Activity["actor"]) => boolean;
  redo: (actor?: Activity["actor"]) => boolean;
  undoAgent: () => boolean;
  resetView: () => void;
  log: (actor: Activity["actor"], message: string) => void;
  armConnect: () => void;
  cancelConnect: () => void;
  pickConnect: (id: string) => void;
}

function defaultsFor(kind: ElementKind): Omit<CanvasElement, "id" | "kind" | "z"> {
  switch (kind) {
    case "frame":
      return { x: 80, y: 80, width: 320, height: 220, text: "Frame", fill: "#fffcf7", stroke: "#d8d3c8", fontSize: 13 };
    case "rectangle":
      return { x: 120, y: 120, width: 168, height: 104, text: "", fill: "#5b7fb5", stroke: "#3f5d88", fontSize: 14 };
    case "ellipse":
      return { x: 120, y: 120, width: 140, height: 140, text: "", fill: "#5a9e86", stroke: "#3f7a66", fontSize: 14 };
    case "text":
      return { x: 140, y: 140, width: 220, height: 40, text: "Text", fill: "#1a1a1e", stroke: "transparent", fontSize: 22 };
    case "sticky":
      return { x: 140, y: 140, width: 180, height: 160, text: "Note", fill: "#f3e4c6", stroke: "#d4b57a", fontSize: 15 };
  }
}

const undoStack: Snapshot[] = [];
const redoStack: Snapshot[] = [];
let shotThisGesture = false;
let holdGesture = false;

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

function hist() {
  return { undoDepth: undoStack.length, redoDepth: redoStack.length };
}

function checkpoint(get: () => CanvasState) {
  if (shotThisGesture) return;
  undoStack.push(capture(get()));
  if (undoStack.length > 40) undoStack.shift();
  redoStack.length = 0;
  shotThisGesture = true;
}

function remember(get: () => CanvasState, opts?: { undo?: boolean }) {
  if (opts?.undo === false && !holdGesture) return;
  checkpoint(get);
}

function afterMutate() {
  if (!holdGesture) shotThisGesture = false;
}

function only(id: string | null) {
  return { selectedId: id, selectedIds: id ? [id] : [] };
}

function dropSelected(s: { selectedId: string | null; selectedIds: string[] }, gone: Set<string>) {
  const selectedIds = s.selectedIds.filter((id) => !gone.has(id));
  const selectedId =
    s.selectedId && !gone.has(s.selectedId) ? s.selectedId : (selectedIds[selectedIds.length - 1] ?? null);
  return { selectedId, selectedIds };
}

function applySnap(set: (partial: Partial<CanvasState>) => void, snap: Snapshot) {
  set({
    elements: snap.elements,
    connectors: snap.connectors,
    ...only(snap.selectedId),
    background: snap.background,
    brief: snap.brief,
    pins: snap.pins,
    connectArmed: false,
    connectFromId: null,
    ...hist(),
  });
}

function isKind(value: unknown): value is ElementKind {
  return KINDS.includes(value as ElementKind);
}

function sanitizeElement(raw: unknown, index: number): CanvasElement | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Partial<CanvasElement>;
  if (!isKind(e.kind)) return null;
  const base = defaultsFor(e.kind);
  const id = typeof e.id === "string" && e.id.trim() ? e.id : `tmp_${index}`;
  return {
    id,
    kind: e.kind,
    x: clampPos(e.x, base.x),
    y: clampPos(e.y, base.y),
    width: clampW(e.width, base.width),
    height: clampH(e.height, base.height),
    text: boardCopy(typeof e.text === "string" ? e.text : base.text),
    fill: typeof e.fill === "string" ? e.fill : base.fill,
    stroke: typeof e.stroke === "string" ? e.stroke : base.stroke,
    fontSize: clampFont(e.fontSize, base.fontSize),
    z: Math.round(finite(e.z, index)),
  };
}

function sanitizeConnector(raw: unknown): Connector | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<Connector>;
  if (typeof c.id !== "string" || !c.id.trim()) return null;
  if (typeof c.from !== "string" || typeof c.to !== "string") return null;
  return { id: c.id, from: c.from, to: c.to, label: plainCopy(typeof c.label === "string" ? c.label : "") };
}

function sanitizePin(raw: unknown): Pin | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<Pin>;
  if (typeof p.id !== "string" || !p.id.trim()) return null;
  if (typeof p.elementId !== "string") return null;
  const actor = p.actor === "agent" ? "agent" : "human";
  return {
    id: p.id,
    elementId: p.elementId,
    actor,
    text: plainCopy(typeof p.text === "string" ? p.text : "Look here"),
    resolved: Boolean(p.resolved),
  };
}

export function sanitizePersisted(data: unknown): Snapshot | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Partial<Snapshot>;
  if (!Array.isArray(raw.elements)) return null;
  const seen = new Set<string>();
  const elements: CanvasElement[] = [];
  raw.elements.forEach((item, index) => {
    const el = sanitizeElement(item, index);
    if (!el) return;
    if (seen.has(el.id)) el.id = `${el.kind}_${index}_${seen.size}`;
    seen.add(el.id);
    elements.push(el);
  });
  const connectors = Array.isArray(raw.connectors)
    ? raw.connectors.map(sanitizeConnector).filter((c): c is Connector => Boolean(c))
    : [];
  const pins = Array.isArray(raw.pins) ? raw.pins.map(sanitizePin).filter((p): p is Pin => Boolean(p)) : [];
  const ids = new Set([...elements.map((e) => e.id), ...connectors.map((c) => c.id)]);
  const selectedId =
    typeof raw.selectedId === "string" && ids.has(raw.selectedId) ? raw.selectedId : null;
  const background = typeof raw.background === "string" && raw.background.trim() ? raw.background : LIGHT_BOARD;
  const brief = typeof raw.brief === "string" ? plainCopy(raw.brief) : "";
  return { elements, connectors, selectedId, background, brief, pins };
}

function loadPersisted(): Snapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitizePersisted(JSON.parse(raw));
  } catch {
    return null;
  }
}

const persisted = loadPersisted();
if (persisted) {
  adoptIds([
    ...persisted.elements.filter((e) => !e.id.startsWith("tmp_")).map((e) => e.id),
    ...persisted.connectors.map((c) => c.id),
    ...persisted.pins.map((p) => p.id),
  ]);
  persisted.elements = persisted.elements.map((el) =>
    el.id.startsWith("tmp_") ? { ...el, id: nextId(el.kind) } : el
  );
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  elements: persisted?.elements ?? [],
  connectors: persisted?.connectors ?? [],
  selectedId: persisted?.selectedId ?? null,
  selectedIds: persisted?.selectedId ? [persisted.selectedId] : [],
  background: persisted?.background ?? LIGHT_BOARD,
  activity: [],
  brief: persisted?.brief ?? "",
  pins: persisted?.pins ?? [],
  undoDepth: 0,
  redoDepth: 0,
  resetViewNonce: 0,
  connectArmed: false,
  connectFromId: null,

  log: (actor, message) =>
    set((s) => ({
      activity: [
        { id: nextId("act"), actor, message, at: Date.now() },
        ...s.activity,
      ].slice(0, 120),
    })),

  beginAgentTurn: () => {
    if (!holdGesture) shotThisGesture = false;
  },

  beginAgentBatch: () => {
    shotThisGesture = false;
    holdGesture = true;
  },

  endAgentBatch: () => {
    holdGesture = false;
    shotThisGesture = false;
  },

  beginGesture: () => {
    holdGesture = true;
    shotThisGesture = false;
  },

  endGesture: () => {
    holdGesture = false;
    shotThisGesture = false;
  },

  undo: (actor = "human") => {
    const snap = undoStack.pop();
    if (!snap) return false;
    redoStack.push(capture(get()));
    applySnap(set, snap);
    get().log(actor, "undid the last change");
    return true;
  },

  redo: (actor = "human") => {
    const snap = redoStack.pop();
    if (!snap) return false;
    undoStack.push(capture(get()));
    applySnap(set, snap);
    get().log(actor, "redid the last change");
    return true;
  },

  undoAgent: () => get().undo("agent"),

  addElement: (partial, actor = "human", opts) => {
    remember(get, opts);
    const kind = partial.kind;
    const base = defaultsFor(kind);
    const maxZ = get().elements.reduce((m, e) => Math.max(m, e.z), 0);
    const n = get().elements.length;
    const el: CanvasElement = {
      id: nextId(kind),
      kind,
      z: Math.round(finite(partial.z, maxZ + 1)),
      x: clampPos(partial.x ?? base.x + (n % 6) * 18, base.x),
      y: clampPos(partial.y ?? base.y + (n % 6) * 18, base.y),
      width: clampW(partial.width, base.width),
      height: clampH(partial.height, base.height),
      text: boardCopy(typeof partial.text === "string" ? partial.text : base.text),
      fill: typeof partial.fill === "string" ? partial.fill : base.fill,
      stroke: typeof partial.stroke === "string" ? partial.stroke : base.stroke,
      fontSize: clampFont(partial.fontSize, base.fontSize),
    };
    if ((kind === "rectangle" || kind === "ellipse") && partial.fill === undefined) {
      el.fill = PALETTE[get().elements.length % PALETTE.length];
    }
    set((s) => ({
      elements: [...s.elements, el],
      ...only(el.id),
      ...hist(),
    }));
    if (opts?.log !== false) {
      get().log(actor, `added ${elementName(el)}`);
    }
    afterMutate();
    return el;
  },

  updateElement: (id, patch, actor = "human", opts) => {
    const current = get().elements.find((e) => e.id === id);
    if (!current) return null;
    const next: CanvasElement = {
      ...current,
      ...patch,
      id: current.id,
      kind: current.kind,
      x: patch.x != null ? clampPos(patch.x, current.x) : current.x,
      y: patch.y != null ? clampPos(patch.y, current.y) : current.y,
      width: patch.width != null ? clampW(patch.width, current.width) : current.width,
      height: patch.height != null ? clampH(patch.height, current.height) : current.height,
      fontSize: patch.fontSize != null ? clampFont(patch.fontSize, current.fontSize) : current.fontSize,
      text: patch.text != null ? boardCopy(String(patch.text)) : current.text,
      fill: patch.fill != null ? String(patch.fill) : current.fill,
      stroke: patch.stroke != null ? String(patch.stroke) : current.stroke,
      z: patch.z != null ? Math.round(finite(patch.z, current.z)) : current.z,
    };
    if (sameElement(current, next)) return current;
    remember(get, opts);
    set((s) => ({
      elements: s.elements.map((e) => (e.id === id ? next : e)),
      ...hist(),
    }));
    if (opts?.log !== false) {
      get().log(actor, `updated ${itemName(get(), id)}`);
    }
    afterMutate();
    return next;
  },

  moveElement: (id, x, y, actor = "human", opts) => {
    return get().updateElement(id, { x, y }, actor, opts);
  },

  layerElement: (id, action, actor = "human") => {
    const label = itemName(get(), id);
    const next = applyLayer(get().elements, id, action);
    if (!next) return null;
    if (next === get().elements) {
      return get().elements.find((e) => e.id === id) ?? null;
    }
    remember(get);
    set({ elements: next, ...only(id), ...hist() });
    get().log(actor, LAYER_LOG[action](label));
    afterMutate();
    return get().elements.find((e) => e.id === id) ?? null;
  },

  duplicateElement: (id, actor = "human") => {
    const src = get().elements.find((e) => e.id === id);
    if (!src) return null;
    const copy = get().addElement(
      {
        kind: src.kind,
        x: src.x + 24,
        y: src.y + 24,
        width: src.width,
        height: src.height,
        text: src.text,
        fill: src.fill,
        stroke: src.stroke,
        fontSize: src.fontSize,
      },
      actor,
      { log: false }
    );
    get().log(actor, `duplicated ${elementName(src)}`);
    return copy;
  },

  alignElement: (id, edge, actor = "human") => {
    const el = get().elements.find((e) => e.id === id);
    if (!el) return null;
    const box = alignBox(el, get().elements);
    const x0 = box.x + box.padX;
    const y0 = box.y + box.padY;
    const x1 = box.x + box.width - box.padX;
    const y1 = box.y + box.height - box.padY;
    let x = el.x;
    let y = el.y;
    if (edge === "left") x = x0;
    if (edge === "right") x = x1 - el.width;
    if (edge === "center") x = box.x + (box.width - el.width) / 2;
    if (edge === "top") y = y0;
    if (edge === "bottom") y = y1 - el.height;
    if (edge === "middle") y = box.y + (box.height - el.height) / 2;
    const next = get().updateElement(
      id,
      { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) },
      actor,
      { log: false }
    );
    if (next) get().log(actor, `aligned ${elementName(el)} to the ${ALIGN_LOG[edge]}`);
    return next;
  },

  nudgeElement: (id, dx, dy, actor = "human", opts) => {
    const el = get().elements.find((e) => e.id === id);
    if (!el) return null;
    return get().updateElement(
      id,
      { x: Math.max(0, Math.round(el.x + dx)), y: Math.max(0, Math.round(el.y + dy)) },
      actor,
      opts
    );
  },

  deleteElement: (id, actor = "human") => get().deleteElements([id], actor) > 0,

  deleteElements: (ids, actor = "human") => {
    const gone = new Set(ids.filter((id) => get().elements.some((e) => e.id === id)));
    if (gone.size === 0) return 0;
    const labels = [...gone].map((id) => itemName(get(), id));
    remember(get);
    set((s) => {
      const elements = s.elements.filter((e) => !gone.has(e.id));
      const connecting = s.connectArmed && elements.length >= 2;
      return {
        elements,
        connectors: s.connectors.filter((c) => !gone.has(c.from) && !gone.has(c.to)),
        pins: s.pins.filter((p) => !gone.has(p.elementId)),
        ...dropSelected(s, gone),
        connectArmed: connecting,
        connectFromId: connecting && s.connectFromId && !gone.has(s.connectFromId) ? s.connectFromId : null,
        ...hist(),
      };
    });
    get().log(actor, gone.size === 1 ? `deleted ${labels[0]}` : `deleted ${gone.size} nodes`);
    afterMutate();
    return gone.size;
  },

  deleteConnector: (id, actor = "human") => {
    if (!get().connectors.some((c) => c.id === id)) return false;
    remember(get);
    set((s) => ({
      connectors: s.connectors.filter((c) => c.id !== id),
      ...dropSelected(s, new Set([id])),
      ...hist(),
    }));
    get().log(actor, "removed a connector");
    afterMutate();
    return true;
  },

  updateConnector: (id, patch, actor = "human", opts) => {
    const current = get().connectors.find((c) => c.id === id);
    if (!current) return null;
    const updated: Connector = {
      ...current,
      ...patch,
      id: current.id,
      from: current.from,
      to: current.to,
      label: patch.label != null ? plainCopy(String(patch.label)) : current.label,
    };
    if (updated.label === current.label) return current;
    remember(get, opts);
    set((s) => ({
      connectors: s.connectors.map((c) => (c.id === id ? updated : c)),
      ...hist(),
    }));
    if (opts?.log !== false) get().log(actor, "updated a connector");
    afterMutate();
    return updated;
  },

  reverseConnector: (id, actor = "human") => {
    const current = get().connectors.find((c) => c.id === id);
    if (!current) return null;
    remember(get);
    let updated: Connector | null = null;
    set((s) => {
      const other = s.connectors.find(
        (c) => c.id !== id && c.from === current.to && c.to === current.from
      );
      return {
        connectors: s.connectors
          .filter((c) => c.id !== other?.id)
          .map((c) => {
            if (c.id !== id) return c;
            updated = { ...c, from: c.to, to: c.from };
            return updated;
          }),
        ...only(id),
        ...hist(),
      };
    });
    if (updated) {
      get().log(
        actor,
        `reversed ${itemName(get(), current.to)} to ${itemName(get(), current.from)}`
      );
    }
    afterMutate();
    return updated;
  },

  select: (id, actor = "human", opts) => {
    if (!id) {
      set(only(null));
      return;
    }
    const isNode = get().elements.some((e) => e.id === id);
    const isConn = get().connectors.some((c) => c.id === id);
    if (!isNode && !isConn) return;
    if (opts?.additive && isNode) {
      const nodes = new Set(get().elements.map((e) => e.id));
      const current = get().selectedIds.filter((sid) => nodes.has(sid));
      const next = current.includes(id) ? current.filter((sid) => sid !== id) : [...current, id];
      set({ selectedId: next[next.length - 1] ?? null, selectedIds: next });
    } else {
      set(only(id));
    }
    if (actor === "agent") get().log(actor, `selected ${itemName(get(), id)}`);
  },

  selectMany: (ids) => {
    const nodes = new Set(get().elements.map((e) => e.id));
    const selectedIds = [...new Set(ids)].filter((id) => nodes.has(id));
    set({ selectedId: selectedIds[selectedIds.length - 1] ?? null, selectedIds });
  },

  setBackground: (color, actor = "human", opts) => {
    if (get().background.toLowerCase() === color.toLowerCase()) return;
    if (!opts?.themeSync) clearAutoBoardFrom();
    if (opts?.undo !== false) remember(get);
    set({ background: color, ...(opts?.undo === false ? {} : hist()) });
    if (opts?.log !== false) get().log(actor, `set canvas background to ${color}`);
    if (opts?.undo !== false) afterMutate();
  },

  connect: (from, to, label, actor = "human") => {
    const els = get().elements;
    if (!els.some((e) => e.id === from) || !els.some((e) => e.id === to) || from === to) {
      return null;
    }
    const existing = get().connectors.find((c) => c.from === from && c.to === to);
    if (existing) {
      get().log(actor, `${itemName(get(), from)} is already connected to ${itemName(get(), to)}`);
      return existing;
    }
    remember(get);
    const connector: Connector = { id: nextId("conn"), from, to, label: plainCopy(label) };
    set((s) => ({ connectors: [...s.connectors, connector], ...hist() }));
    get().log(actor, `connected ${itemName(get(), from)} to ${itemName(get(), to)}`);
    afterMutate();
    return connector;
  },

  armConnect: () => {
    const s = get();
    if (s.connectArmed) {
      set({ connectArmed: false, connectFromId: null });
      return;
    }
    if (s.elements.length < 2) return;
    set({ connectArmed: true, connectFromId: null });
  },

  cancelConnect: () => {
    if (!get().connectArmed && !get().connectFromId) return;
    set({ connectArmed: false, connectFromId: null });
  },

  pickConnect: (id) => {
    const s = get();
    if (!s.connectArmed || !s.elements.some((e) => e.id === id)) return;
    if (!s.connectFromId) {
      set({ connectFromId: id, ...only(id) });
      return;
    }
    if (s.connectFromId === id) return;
    get().connect(s.connectFromId, id, "next", "human");
    set({ connectArmed: false, connectFromId: null });
  },

  clearAll: (actor = "human") => {
    remember(get);
    set((s) => ({
      elements: [],
      connectors: [],
      pins: [],
      ...only(null),
      connectArmed: false,
      connectFromId: null,
      resetViewNonce: s.resetViewNonce + 1,
      ...hist(),
    }));
    get().log(actor, "cleared the canvas");
    afterMutate();
  },

  resetView: () => set((s) => ({ resetViewNonce: s.resetViewNonce + 1 })),

  arrangeGrid: (columns, actor = "human") => {
    remember(get);
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
      ...hist(),
    }));
    get().log(actor, `arranged ${count} elements into a ${cols}-column grid`);
    afterMutate();
    return count;
  },

  setBrief: (brief, actor = "human", opts) => {
    const next = plainCopy(brief);
    if (get().brief === next) return;
    remember(get, opts);
    set({ brief: next, ...hist() });
    if (opts?.log !== false) {
      get().log(actor, next.trim() ? "updated the brief" : "cleared the brief");
    }
    afterMutate();
  },

  addPin: (elementId, text, actor = "human") => {
    if (!get().elements.some((e) => e.id === elementId)) return null;
    remember(get);
    const pin: Pin = {
      id: nextId("pin"),
      elementId,
      actor,
      text: plainCopy(text).trim() || "Look here",
      resolved: false,
    };
    set((s) => ({ pins: [...s.pins, pin], ...only(elementId), ...hist() }));
    get().log(actor, `pinned ${itemName(get(), elementId)}`);
    afterMutate();
    return pin;
  },

  resolvePin: (id, actor = "human") => {
    const pin = get().pins.find((p) => p.id === id);
    if (!pin || pin.resolved) return false;
    remember(get);
    set((s) => ({
      pins: s.pins.map((p) => (p.id === id ? { ...p, resolved: true } : p)),
      ...hist(),
    }));
    get().log(actor, `resolved a pin on ${itemName(get(), pin.elementId)}`);
    afterMutate();
    return true;
  },
}));

export function resetCanvasStore() {
  undoStack.length = 0;
  redoStack.length = 0;
  shotThisGesture = false;
  holdGesture = false;
  idCounter = 0;
  useCanvasStore.setState({
    elements: [],
    connectors: [],
    selectedId: null,
    selectedIds: [],
    background: LIGHT_BOARD,
    activity: [],
    brief: "",
    pins: [],
    undoDepth: 0,
    redoDepth: 0,
    resetViewNonce: 0,
    connectArmed: false,
    connectFromId: null,
  });
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable.
  }
  clearAutoBoardFrom();
}

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
      // Storage unavailable. The live board still works.
    }
  });
}

import { confirmAction } from "../confirmAction";
import { downloadBoardPng } from "../exportBoard";
import { KIND_LABEL, type AlignEdge, type LayerAction } from "../labels";
import { sketchFromBrief } from "../layouts/draft";
import { blockedConnectorReason, reviewCanvas } from "../review/reviewCanvas";
import { useCanvasStore, type CanvasState } from "../store/canvasStore";
import type { CanvasElement, ElementKind } from "../types";
import {
  createPageModelContext,
  detectNativeModelContext,
  resultToText,
  type JSONSchema,
  type ModelContextLike,
  type ToolDefinition,
} from "./polyfill";

const LAYER_ACTIONS: LayerAction[] = ["front", "back", "forward", "backward"];
const ALIGN_EDGES: AlignEdge[] = ["left", "center", "right", "top", "middle", "bottom"];
const KINDS: ElementKind[] = ["frame", "rectangle", "ellipse", "text", "sticky"];
const OUTPUT_BUDGET = 1500;
const LIST_CAP = 24;

export { CHATGPT_BRIEF, FRONTIER_BRIEF, MODELS_BRIEF, SAMPLE_BRIEF } from "../guide";

function store() {
  return useCanvasStore.getState();
}

function clip(text: string, n = 80) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

function describe(el: CanvasElement, compact = false) {
  const base = {
    id: el.id,
    kind: el.kind,
    x: Math.round(el.x),
    y: Math.round(el.y),
    z: el.z,
    text: clip(el.text),
  };
  if (compact) {
    return { ...base, w: Math.round(el.width), h: Math.round(el.height) };
  }
  return {
    ...base,
    width: Math.round(el.width),
    height: Math.round(el.height),
    fill: el.fill,
    stroke: el.stroke,
    fontSize: el.fontSize,
  };
}

function ok(text: string) {
  if (text.length <= OUTPUT_BUDGET) {
    return { content: [{ type: "text" as const, text }] };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `${text.slice(0, OUTPUT_BUDGET - 14)}\n…truncated`,
      },
    ],
  };
}

function asAgent<T>(fn: () => T): T {
  store().beginAgentTurn();
  return fn();
}

function freezeSchema(schema?: JSONSchema): JSONSchema {
  return {
    type: "object",
    properties: {},
    ...schema,
    additionalProperties: false,
  };
}

function isAvailable(name: string, s: CanvasState): boolean {
  const hasBrief = s.brief.trim().length > 0;
  const n = s.elements.length;
  const openPins = s.pins.some((p) => !p.resolved);
  switch (name) {
    case "draft_from_brief":
    case "review_canvas":
      return hasBrief;
    case "connect_elements":
    case "arrange_grid":
      return n >= 2;
    case "reverse_connector":
      return s.connectors.length > 0;
    case "pin_element":
    case "update_element":
    case "move_element":
    case "delete_element":
    case "layer_element":
    case "duplicate_element":
    case "align_element":
    case "export_png":
      return n > 0;
    case "list_pins":
      return s.pins.length > 0;
    case "resolve_pin":
      return openPins;
    case "undo_last":
      return s.undoDepth > 0;
    case "redo_last":
      return s.redoDepth > 0;
    default:
      return true;
  }
}

function gateKey(s: CanvasState): string {
  return [
    s.brief.trim() ? 1 : 0,
    s.elements.length,
    s.connectors.length,
    s.pins.length,
    s.pins.some((p) => !p.resolved) ? 1 : 0,
    s.undoDepth,
    s.redoDepth,
  ].join(":");
}

function draftFromBrief(brief: string) {
  const s = store();
  s.beginAgentBatch();
  try {
    if (s.elements.length || s.connectors.length || s.pins.length) {
      s.clearAll("agent");
    }
    s.resetView();
    const ids = sketchFromBrief(brief, s);
    s.select(null, "agent");
    return ids;
  } finally {
    s.endAgentBatch();
  }
}

function toolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "get_brief",
      title: "Get the design brief",
      description:
        "Read the job on this board: the brief the human wrote. Call this before drafting or reviewing so you know what the flow must cover.",
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const brief = store().brief;
        return ok(
          brief.trim()
            ? JSON.stringify({ brief }, null, 2)
            : "No brief yet. Ask the human to write one, or call set_brief."
        );
      },
    },
    {
      name: "get_canvas_summary",
      title: "Summarize the canvas",
      description:
        "Get a high-level snapshot: brief, element counts, connectors, open pins, background, and the currently selected element. Call this first to understand the live design before making changes.",
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const s = store();
        const counts: Record<string, number> = {};
        for (const e of s.elements) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
        const selected = s.elements.find((e) => e.id === s.selectedId) ?? null;
        return ok(
          JSON.stringify(
            {
              app: "CoCanvas. Your brief. Your board. Your agent.",
              brief: clip(s.brief, 160),
              totalElements: s.elements.length,
              countsByKind: counts,
              connectors: s.connectors.length,
              openPins: s.pins.filter((p) => !p.resolved).length,
              background: s.background,
              selectedId: s.selectedId,
              selected: selected ? describe(selected, true) : null,
            },
            null,
            2
          )
        );
      },
    },
    {
      name: "list_elements",
      title: "List canvas elements",
      description:
        "List elements on the canvas with id, kind, position, size, layer (z), and text. Use this to find the id of an element you want to update, move, layer, duplicate, align, connect, pin, or delete.",
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: KINDS,
            description: "Optional filter to only return elements of this kind.",
          },
        },
      },
      execute: (input: { kind?: ElementKind }) => {
        let els = store().elements;
        if (input?.kind) els = els.filter((e) => e.kind === input.kind);
        const total = els.length;
        const shown = els.slice(0, LIST_CAP).map((e) => describe(e, true));
        return ok(
          JSON.stringify(
            {
              total,
              showing: shown.length,
              truncated: total > shown.length,
              elements: shown,
            },
            null,
            2
          )
        );
      },
    },
    {
      name: "review_canvas",
      title: "Review the board against the brief",
      description:
        "Run the page's own design review. Returns structured findings: brief gaps, a typeset table with no diagram, unlabeled shapes, orphan nodes, missing start or end, side arrows between siblings, arrows on score bars, a stretched hub, overlaps, and open pins. Use this after drafting. Then delete any side_link or score_link arrow, shrink a wide_hub, pin_element on the nodes that need work, or add the missing steps.",
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const s = store();
        const report = reviewCanvas({
          brief: s.brief,
          elements: s.elements,
          connectors: s.connectors,
          pins: s.pins,
        });
        return ok(JSON.stringify(report, null, 2));
      },
    },
    {
      name: "list_pins",
      title: "List critique pins",
      description: "List critique pins on the board. Open pins are unresolved comments from the human or the agent.",
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      inputSchema: {
        type: "object",
        properties: {
          openOnly: {
            type: "boolean",
            description: "If true, only return unresolved pins.",
          },
        },
      },
      execute: (input: { openOnly?: boolean }) => {
        let pins = store().pins;
        if (input?.openOnly) pins = pins.filter((p) => !p.resolved);
        return ok(
          JSON.stringify(
            pins.map((p) => ({
              ...p,
              text: clip(p.text, 120),
            })),
            null,
            2
          )
        );
      },
    },
    {
      name: "set_brief",
      title: "Set the design brief",
      description:
        "Write or replace the job on this board. The brief is what review_canvas checks against. Keep it concrete: the steps a flow must include.",
      inputSchema: {
        type: "object",
        properties: {
          brief: { type: "string", description: "The job to-be-done on this canvas." },
        },
        required: ["brief"],
      },
      execute: (input: { brief: string }) => {
        return asAgent(() => {
          store().setBrief(input.brief ?? "", "agent");
          return ok(`Brief set. ${input.brief.trim() ? "Call review_canvas after you draft." : "Brief cleared."}`);
        });
      },
    },
    {
      name: "draft_from_brief",
      title: "Draft a flow from the brief",
      description:
        "Read the current brief and sketch a connected board from its words. This is a first pass, not a branded template. Prefer composing with add_element when the brief is a specific screen or ranking. Call get_brief first if you are unsure it is set. After drafting, call review_canvas and pin any gaps.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        return asAgent(() => {
          const brief = store().brief.trim();
          if (!brief) return ok("Error: no brief. Call set_brief first, or ask the human to write one.");
          const ids = draftFromBrief(brief);
          return ok(`Drafted the board from the brief (${ids.length} nodes). Ids: ${ids.join(", ")}. Call review_canvas next.`);
        });
      },
    },
    {
      name: "pin_element",
      title: "Pin a critique on an element",
      description:
        "Leave a visible pin on an element so the human sees what you mean. Use after review_canvas. The pin is a first-class object on the live board, not a chat message.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Element id to pin." },
          note: { type: "string", description: "What is wrong or what to do next." },
        },
        required: ["id", "note"],
      },
      execute: (input: { id: string; note: string }) => {
        return asAgent(() => {
          const pin = store().addPin(input.id, input.note, "agent");
          if (!pin) return ok(`Error: no element with id "${input.id}"`);
          return ok(`Pinned ${input.id} (${pin.id}): ${pin.text}`);
        });
      },
    },
    {
      name: "resolve_pin",
      title: "Resolve a pin",
      description: "Mark a pin as resolved after the gap has been fixed.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Pin id from list_pins." } },
        required: ["id"],
      },
      execute: (input: { id: string }) => {
        return asAgent(() => {
          const okResolve = store().resolvePin(input.id, "agent");
          return ok(okResolve ? `Resolved ${input.id}.` : `Error: no open pin "${input.id}"`);
        });
      },
    },
    {
      name: "undo_last",
      title: "Undo the last change",
      description:
        "Revert the most recent canvas change, including a human edit or a full agent turn. The human can also undo and redo from the toolbar.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const undone = store().undo("agent");
        return ok(undone ? "Reverted the last change." : "Nothing to undo.");
      },
    },
    {
      name: "redo_last",
      title: "Redo the last undone change",
      description: "Re-apply the change that undo_last or the toolbar Undo button just reverted.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const redone = store().redo("agent");
        return ok(redone ? "Redid the last change." : "Nothing to redo.");
      },
    },
    {
      name: "add_element",
      title: "Add an element",
      description:
        "Add one element. A finished board is a diagram: nodes (rectangle or ellipse) plus connect_elements. Facts go on nodes. Heading on line one, facts on the next line (WHO GETS IT then a newline then Plus. Pro. Business. Enterprise.). Do not drop kind text on arrows. Leave 32px between nodes. Title can be kind text. A hub ellipse is about 320 by 100. Do not stretch it across the child row. Score bars are charcoal rectangles, height 28. Never connect a bar, a score label, or a number. Always pass fill and stroke; omitted fill becomes a candy blue card. For text, fill is the ink color (#f4f4f5 on dark paper). ASCII labels only. Paper #0a0a0a. Keep x from 40 to 1400 and y from 24 to 1600.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: KINDS, description: "The type of element to add." },
          x: { type: "number", description: "Left position in canvas pixels." },
          y: { type: "number", description: "Top position in canvas pixels." },
          width: { type: "number", description: "Width in pixels." },
          height: { type: "number", description: "Height in pixels." },
          text: { type: "string", description: "Text content (for text, sticky, frame title)." },
          fill: {
            type: "string",
            description: "Hex color. Required for a designed board. Text ink on dark paper: #f4f4f5. Rules: #2a2a2e. Bars: #2c2f36. Do not use candy blue or green.",
          },
          stroke: { type: "string", description: "Hex border. Match fill for rules and bars. Use transparent for text." },
          fontSize: { type: "number", description: "Type size. Title 28, row 14, score 20, kicker 12." },
        },
        required: ["kind"],
      },
      execute: (input: Partial<CanvasElement> & { kind: ElementKind }) => {
        return asAgent(() => {
          if (!KINDS.includes(input.kind)) {
            return ok(`Error: kind must be one of ${KINDS.join(", ")}`);
          }
          const el = store().addElement(input, "agent");
          return ok(`Added element:\n${JSON.stringify(describe(el), null, 2)}`);
        });
      },
    },
    {
      name: "update_element",
      title: "Update an element",
      description:
        "Update properties of an existing element by id. Provide only the fields you want to change (text, fill, stroke, fontSize, x, y, width, height). Use list_elements first to find the id.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The id of the element to update." },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          text: { type: "string" },
          fill: { type: "string", description: "Hex color." },
          stroke: { type: "string", description: "Hex color." },
          fontSize: { type: "number" },
        },
        required: ["id"],
      },
      execute: (input: { id: string } & Partial<CanvasElement>) => {
        return asAgent(() => {
          const { id, ...patch } = input;
          const updated = store().updateElement(id, patch, "agent");
          if (!updated) return ok(`Error: no element with id "${id}"`);
          return ok(`Updated:\n${JSON.stringify(describe(updated), null, 2)}`);
        });
      },
    },
    {
      name: "move_element",
      title: "Move an element",
      description:
        "Move an element to an absolute position (x, y) in canvas pixels. Use list_elements to find ids and current positions. Leave a 32px gap between nodes. Keep x from 40 to 1400 and y from 24 to 1600. The page zooms; do not stack items to stay in one screen.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["id", "x", "y"],
      },
      execute: (input: { id: string; x: number; y: number }) => {
        return asAgent(() => {
          const moved = store().moveElement(input.id, input.x, input.y, "agent");
          if (!moved) return ok(`Error: no element with id "${input.id}"`);
          return ok(`Moved ${input.id} to (${Math.round(input.x)}, ${Math.round(input.y)}).`);
        });
      },
    },
    {
      name: "layer_element",
      title: "Change layer order",
      description:
        "Bring an element forward or send it backward. Actions: 'front' (top of the stack), 'back' (behind everything), 'forward' (one step up), 'backward' (one step down). Use this when a card sits behind a frame or another node.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Element id from list_elements." },
          action: {
            type: "string",
            enum: LAYER_ACTIONS,
            description: "front, back, forward, or backward.",
          },
        },
        required: ["id", "action"],
      },
      execute: (input: { id: string; action: LayerAction }) => {
        return asAgent(() => {
          if (!LAYER_ACTIONS.includes(input.action)) {
            return ok(`Error: action must be one of ${LAYER_ACTIONS.join(", ")}`);
          }
          const updated = store().layerElement(input.id, input.action, "agent");
          if (!updated) return ok(`Error: no element with id "${input.id}"`);
          return ok(
            `Layered ${input.id} (${updated.text.trim() || updated.kind}): ${input.action}. z=${updated.z}`
          );
        });
      },
    },
    {
      name: "duplicate_element",
      title: "Duplicate an element",
      description:
        "Copy an element and offset the copy by 24px so it is easy to grab. Pins and connectors are not copied.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Element id to copy." } },
        required: ["id"],
      },
      execute: (input: { id: string }) => {
        return asAgent(() => {
          const copy = store().duplicateElement(input.id, "agent");
          if (!copy) return ok(`Error: no element with id "${input.id}"`);
          return ok(`Duplicated:\n${JSON.stringify(describe(copy), null, 2)}`);
        });
      },
    },
    {
      name: "align_element",
      title: "Align an element",
      description:
        "Align an element inside its parent frame, or to the page if it is not inside a frame. Edges: left, center, right, top, middle, bottom.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          edge: { type: "string", enum: ALIGN_EDGES },
        },
        required: ["id", "edge"],
      },
      execute: (input: { id: string; edge: AlignEdge }) => {
        return asAgent(() => {
          if (!ALIGN_EDGES.includes(input.edge)) {
            return ok(`Error: edge must be one of ${ALIGN_EDGES.join(", ")}`);
          }
          const updated = store().alignElement(input.id, input.edge, "agent");
          if (!updated) return ok(`Error: no element with id "${input.id}"`);
          return ok(`Aligned ${input.id} to the ${input.edge}.`);
        });
      },
    },
    {
      name: "delete_element",
      title: "Delete an element",
      description:
        "Delete an element from the canvas by id, along with any connectors and pins attached to it. The page asks the human to confirm before deleting.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      execute: async (input: { id: string }) => {
        const target = store().elements.find((e) => e.id === input.id);
        if (!target) return ok(`Error: no element with id "${input.id}"`);
        const yes = await confirmAction({
          title: "Delete this node?",
          body: target.text.trim()
            ? `Delete "${clip(target.text)}" and any arrows or pins on it.`
            : `Delete this ${KIND_LABEL[target.kind]} and any arrows or pins on it.`,
          confirmLabel: "Delete",
        });
        if (!yes) return ok("Cancelled. Nothing deleted.");
        return asAgent(() => {
          const removed = store().deleteElement(input.id, "agent");
          return ok(removed ? `Deleted ${input.id}.` : `Error: no element with id "${input.id}"`);
        });
      },
    },
    {
      name: "select_element",
      title: "Select an element",
      description:
        "Select and highlight an element so the human collaborator can see which element you are referring to. Pass null or omit id to clear the selection.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Element id, or omit to clear." } },
      },
      execute: (input: { id?: string | null }) => {
        const id = input?.id ?? null;
        if (id && !store().elements.some((e) => e.id === id)) {
          return ok(`Error: no element with id "${id}"`);
        }
        store().select(id, "agent");
        return ok(id ? `Selected ${id}.` : "Cleared selection.");
      },
    },
    {
      name: "connect_elements",
      title: "Connect two elements",
      description:
        "Draw a labeled connector from one topic node to another. On a product map, only hub to child (Capabilities, Who, API, Rollout). Never connect those siblings to each other. Never connect a score bar, score label, or number. Cited scores are a list. A board of only text is a failed board. Both ids must exist.",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", description: "Source element id." },
          to: { type: "string", description: "Target element id." },
          label: { type: "string", description: "Optional label shown on the connector." },
        },
        required: ["from", "to"],
      },
      execute: (input: { from: string; to: string; label?: string }) => {
        return asAgent(() => {
          const s = store();
          const from = s.elements.find((e) => e.id === input.from);
          const to = s.elements.find((e) => e.id === input.to);
          if (!from || !to) return ok(`Error: one or both ids do not exist (${input.from}, ${input.to}).`);
          if (from.id === to.id) return ok("Error: cannot connect a node to itself.");
          const blocked = blockedConnectorReason(from, to, s.elements, s.connectors);
          if (blocked) return ok(`Error: ${blocked}`);
          const conn = s.connect(input.from, input.to, input.label ?? "", "agent");
          if (!conn) return ok(`Error: one or both ids do not exist (${input.from}, ${input.to}).`);
          return ok(`Connected ${input.from} to ${input.to}.`);
        });
      },
    },
    {
      name: "reverse_connector",
      title: "Reverse a connector",
      description:
        "Flip an arrow so it points the other way. Pass the connector id from get_canvas_summary or by selecting it. If the opposite arrow already exists, that duplicate is removed.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Connector id to reverse." } },
        required: ["id"],
      },
      execute: (input: { id: string }) => {
        return asAgent(() => {
          const flipped = store().reverseConnector(input.id, "agent");
          if (!flipped) return ok(`Error: no connector with id "${input.id}"`);
          return ok(`Reversed connector ${flipped.id}: ${flipped.from} to ${flipped.to}.`);
        });
      },
    },
    {
      name: "arrange_grid",
      title: "Arrange into a grid",
      description:
        "Auto-arrange all elements on the canvas into a tidy grid with the given number of columns. Useful for cleaning up a messy layout.",
      inputSchema: {
        type: "object",
        properties: {
          columns: { type: "number", description: "Number of columns (default 3)." },
        },
      },
      execute: (input: { columns?: number }) => {
        return asAgent(() => {
          const n = store().arrangeGrid(input?.columns ?? 3, "agent");
          return ok(`Arranged ${n} elements into ${input?.columns ?? 3} columns.`);
        });
      },
    },
    {
      name: "set_background",
      title: "Set background color",
      description:
        "Set the canvas paper. Call this first with #0a0a0a for a product map so the void paper reads (the page hides the dot grid on that color). Do not leave the default Night grey. Use a light paper only for a screen mock that should match a live site.",
      inputSchema: {
        type: "object",
        properties: { color: { type: "string", description: "Hex color string." } },
        required: ["color"],
      },
      execute: (input: { color: string }) => {
        return asAgent(() => {
          store().setBackground(input.color, "agent");
          return ok(`Background set to ${input.color}.`);
        });
      },
    },
    {
      name: "export_png",
      title: "Export the board as PNG",
      description:
        "Download a PNG picture of the live board. Use this when the human wants an image of the current flow.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        if (store().elements.length === 0) return ok("The board is empty. Nothing to export.");
        const name = await downloadBoardPng(store());
        store().log("agent", `exported ${name}`);
        return ok(`Started a download of ${name}.`);
      },
    },
    {
      name: "clear_canvas",
      title: "Clear the canvas",
      description:
        "Remove all elements, connectors, and pins from the canvas to start fresh. The brief stays. The page asks the human to confirm. The human can undo this agent turn.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const current = store();
        if (current.elements.length === 0 && current.connectors.length === 0 && current.pins.length === 0) {
          return ok("Canvas is already empty. Brief kept.");
        }
        const yes = await confirmAction({
          title: "Clear the canvas?",
          body: "Removes every node, arrow, and pin. The brief stays. You can undo this agent turn.",
          confirmLabel: "Clear",
        });
        if (!yes) return ok("Cancelled. Canvas unchanged.");
        return asAgent(() => {
          store().clearAll("agent");
          return ok("Canvas cleared. Brief kept.");
        });
      },
    },
  ];
}

const controllers = new Map<string, AbortController>();
let started = false;
let lastGate = "";
let nativeCtx: ModelContextLike | null = null;
let nativeAbort: AbortController | null = null;
let watchStarted = false;
const listeners = new Set<(info: RegistrationInfo) => void>();

function prepare(def: ToolDefinition): ToolDefinition {
  return {
    ...def,
    inputSchema: freezeSchema(def.inputSchema),
  };
}

function availableNames() {
  return toolDefinitions()
    .filter((d) => isAvailable(d.name, store()))
    .map((d) => d.name);
}

function snapshot(): RegistrationInfo {
  return {
    modelContext: createPageModelContext(),
    polyfilled: !nativeCtx,
    toolNames: availableNames(),
  };
}

function notify() {
  const info = snapshot();
  for (const cb of listeners) cb(info);
}

function syncTools(modelContext: ModelContextLike) {
  const s = store();
  const key = gateKey(s);
  if (key === lastGate && started) return;
  lastGate = key;

  const defs = toolDefinitions();
  const wanted = new Set(defs.filter((d) => isAvailable(d.name, s)).map((d) => d.name));

  for (const [name, ac] of [...controllers]) {
    if (wanted.has(name)) continue;
    ac.abort();
    controllers.delete(name);
  }

  for (const def of defs) {
    if (!wanted.has(def.name) || controllers.has(def.name)) continue;
    const ac = new AbortController();
    controllers.set(def.name, ac);
    try {
      const pending = modelContext.registerTool(prepare(def), { signal: ac.signal });
      if (pending && typeof pending.then === "function") {
        pending.catch(() => {
          controllers.delete(def.name);
        });
      }
    } catch {
      controllers.delete(def.name);
    }
  }
}

function syncNative(native: ModelContextLike) {
  nativeAbort?.abort();
  nativeAbort = new AbortController();
  const { signal } = nativeAbort;
  const s = store();
  for (const def of toolDefinitions()) {
    if (!isAvailable(def.name, s)) continue;
    try {
      const pending = native.registerTool(prepare(def), { signal });
      if (pending && typeof pending.then === "function") {
        pending.catch(() => undefined);
      }
    } catch {
      // Host rejected this tool; the rest still register.
    }
  }
}

function bindNative(): boolean {
  const native = detectNativeModelContext();
  if (!native || native === nativeCtx) return Boolean(nativeCtx);
  nativeCtx = native;
  syncNative(native);
  notify();
  return true;
}

function startLateBindWatch() {
  if (watchStarted || nativeCtx) return;
  watchStarted = true;

  const tryBind = () => {
    if (nativeCtx) return;
    bindNative();
    if (nativeCtx) window.clearInterval(id);
  };

  const id = window.setInterval(tryBind, 500);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tryBind();
  });
}

export interface RegistrationInfo {
  modelContext: ModelContextLike;
  polyfilled: boolean;
  toolNames: string[];
}

function installToolsHook(modelContext: ModelContextLike) {
  window.__cocanvasTools = {
    list: () => availableNames(),
    execute: async (name, input) => resultToText(await modelContext.executeTool(name, input)),
  };
}

export function refreshNativeBinding(): boolean {
  return bindNative();
}

export function subscribeRegistration(cb: (info: RegistrationInfo) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function registerCoCanvasTools(): RegistrationInfo {
  const page = createPageModelContext();
  installToolsHook(page);

  if (!started) {
    started = true;
    syncTools(page);
    useCanvasStore.subscribe((s, prev) => {
      if (gateKey(s) === gateKey(prev)) return;
      lastGate = "";
      syncTools(page);
      if (nativeCtx) syncNative(nativeCtx);
    });
    bindNative();
    if (!nativeCtx && import.meta.env.MODE !== "test") startLateBindWatch();
  }

  return snapshot();
}

export { resultToText };

import { confirmAction } from "../confirmAction";
import { KIND_LABEL, type AlignEdge, type LayerAction } from "../labels";
import { briefTerms, reviewCanvas } from "../review/reviewCanvas";
import { useCanvasStore, type CanvasState } from "../store/canvasStore";
import { readThemePref, resolveTheme, stockBoardForTheme } from "../theme";
import type { CanvasElement, ElementKind } from "../types";
import {
  ensureModelContext,
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

export const SAMPLE_BRIEF =
  "Grocery checkout: cart review, delivery address, payment, order success. Every step labeled. One path through.";

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

function themeBoard() {
  return stockBoardForTheme(resolveTheme(readThemePref()));
}

function draftFromBrief(brief: string) {
  const terms = briefTerms(brief);
  const s = store();
  s.beginAgentBatch();
  try {
  s.resetView();
  s.setBackground(themeBoard(), "agent");
  s.addElement(
    {
      kind: "text",
      x: 40,
      y: 32,
      width: 520,
      height: 32,
      text: brief.trim().slice(0, 48) || "Flow",
      fill: "#1a1a1e",
      fontSize: 22,
    },
    "agent"
  );

  const steps = terms.length ? terms.slice(0, 6) : ["Start", "Next", "End"];
  const ids: string[] = [];
  steps.forEach((label, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 40 + col * 220;
    const y = 112 + row * 160;
    const isEnd = i === 0 || i === steps.length - 1;
    const el = s.addElement(
      {
        kind: isEnd ? "ellipse" : "rectangle",
        x,
        y,
        width: isEnd ? 148 : 160,
        height: isEnd ? 80 : 68,
        text: label,
        fill: i === 0 ? "#5a9e86" : i === steps.length - 1 ? "#c46b5d" : "#5b7fb5",
        stroke: i === 0 ? "#3f7a66" : i === steps.length - 1 ? "#9a5248" : "#3f5d88",
        fontSize: 14,
      },
      "agent"
    );
    ids.push(el.id);
  });
  for (let i = 0; i < ids.length - 1; i++) {
    s.connect(ids[i], ids[i + 1], i === ids.length - 2 ? "done" : "next", "agent");
  }
  s.select(null, "agent");
  return ids;
  } finally {
    s.endAgentBatch();
  }
}

/** Tools that read and write the same canvas store as the UI. Agent calls are tagged actor: "agent". */
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
        "Run the page's own design review. Returns structured findings: brief gaps (required terms missing from labels), unlabeled shapes, orphan nodes, missing start or end, overlaps, and open pins. Use this after drafting. Then pin_element on the nodes that need work, or add the missing steps.",
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
        "Read the current brief and draft a connected flow from its steps. Call get_brief first if you are unsure it is set. After drafting, call review_canvas and pin any gaps.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        return asAgent(() => {
          const brief = store().brief.trim();
          if (!brief) return ok("Error: no brief. Call set_brief first, or ask the human to write one.");
          const ids = draftFromBrief(brief);
          return ok(`Drafted a ${ids.length}-step flow from the brief. Ids: ${ids.join(", ")}. Call review_canvas next.`);
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
        "Add one element to the canvas: 'frame' (artboard/container), 'rectangle' or 'ellipse' (shapes), 'text' (heading/label), or 'sticky' (sticky note). Returns the created element with its new id. Any omitted field uses a sensible default. Leave at least 56px between nodes so connector labels stay in the gap. Keep x roughly 0 to 880 and y roughly 0 to 560 to stay in view.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: KINDS, description: "The type of element to add." },
          x: { type: "number", description: "Left position in canvas pixels." },
          y: { type: "number", description: "Top position in canvas pixels." },
          width: { type: "number", description: "Width in pixels." },
          height: { type: "number", description: "Height in pixels." },
          text: { type: "string", description: "Text content (for text, sticky, frame title)." },
          fill: { type: "string", description: "Fill color as a hex string, e.g. #6366f1." },
          stroke: { type: "string", description: "Border color as a hex string." },
          fontSize: { type: "number", description: "Font size in pixels." },
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
        "Move an element to an absolute position (x, y) in canvas pixels. Use list_elements to find ids and current positions. Leave a gap between nodes. Keep x roughly 0 to 880 and y roughly 0 to 560 so the element stays in view.",
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
      annotations: { destructiveHint: true },
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
        "Draw a labeled connector/arrow from one element to another. Great for flowcharts and diagrams. Both ids must exist.",
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
          const conn = store().connect(input.from, input.to, input.label ?? "", "agent");
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
      description: "Set the canvas background color (hex string, e.g. #0f172a for dark).",
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
      name: "clear_canvas",
      title: "Clear the canvas",
      description:
        "Remove all elements, connectors, and pins from the canvas to start fresh. The brief stays. The page asks the human to confirm. The human can undo this agent turn.",
      annotations: { destructiveHint: true },
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
    {
      name: "create_layout",
      title: "Create a starter layout",
      description:
        "Replace the current board with a starter layout. The brief stays unless the template sets one. Templates: 'login', 'kanban', 'flowchart', 'checkout'. Prefer draft_from_brief when a brief is already set.",
      inputSchema: {
        type: "object",
        properties: {
          template: {
            type: "string",
            enum: ["login", "kanban", "flowchart", "checkout"],
            description: "Which starter layout to build.",
          },
        },
        required: ["template"],
      },
      execute: (input: { template: "login" | "kanban" | "flowchart" | "checkout" }) => {
        return asAgent(() => {
          const s = store();
          s.beginAgentBatch();
          try {
          if (s.elements.length || s.connectors.length || s.pins.length) {
            s.clearAll("agent");
          }
          s.resetView();
          let message: string;
          switch (input.template) {
            case "login": {
              s.setBackground("#12141a", "agent");
              s.addElement(
                { kind: "frame", x: 40, y: 48, width: 300, height: 400, text: "Sign in", fill: "#fffcf7", stroke: "#d8d3c8" },
                "agent"
              );
              s.addElement({ kind: "text", x: 68, y: 92, width: 244, height: 32, text: "Welcome back", fill: "#1a1a1e", fontSize: 22 }, "agent");
              s.addElement({ kind: "rectangle", x: 68, y: 162, width: 244, height: 42, text: "Email", fill: "#f3efe6", stroke: "#d8d3c8", fontSize: 14 }, "agent");
              s.addElement({ kind: "rectangle", x: 68, y: 216, width: 244, height: 42, text: "Password", fill: "#f3efe6", stroke: "#d8d3c8", fontSize: 14 }, "agent");
              s.addElement({ kind: "rectangle", x: 68, y: 286, width: 244, height: 46, text: "Continue", fill: "#6d74c9", stroke: "#4f5699", fontSize: 15 }, "agent");
              s.addElement({ kind: "text", x: 96, y: 354, width: 190, height: 24, text: "Forgot password?", fill: "#6d74c9", fontSize: 13 }, "agent");
              message = "Built a login screen mockup inside a frame.";
              break;
            }
            case "kanban": {
              const cols = [
                { title: "To do", fill: "#f3e4c6", stroke: "#d4b57a" },
                { title: "In progress", fill: "#d7e0f0", stroke: "#9aa8c4" },
                { title: "Done", fill: "#d7e6d8", stroke: "#8fad93" },
              ];
              cols.forEach((col, i) => {
                const fx = 24 + i * 200;
                s.addElement({ kind: "frame", x: fx, y: 48, width: 180, height: 392, text: col.title, fill: "#fffcf7", stroke: "#d8d3c8" }, "agent");
                s.addElement({ kind: "sticky", x: fx + 16, y: 100, width: 148, height: 86, text: `${col.title} card`, fill: col.fill, stroke: col.stroke, fontSize: 13 }, "agent");
              });
              message = "Built a three-column kanban board.";
              break;
            }
            case "flowchart": {
              s.setBackground(themeBoard(), "agent");
              s.addElement({ kind: "text", x: 40, y: 32, width: 360, height: 32, text: "User journey", fill: "#1a1a1e", fontSize: 22 }, "agent");
              const a = s.addElement({ kind: "ellipse", x: 40, y: 128, width: 140, height: 80, text: "Start", fill: "#5a9e86", stroke: "#3f7a66", fontSize: 14 }, "agent");
              const b = s.addElement({ kind: "rectangle", x: 252, y: 136, width: 160, height: 68, text: "Process", fill: "#5b7fb5", stroke: "#3f5d88", fontSize: 14 }, "agent");
              const c = s.addElement({ kind: "ellipse", x: 492, y: 128, width: 140, height: 80, text: "End", fill: "#c46b5d", stroke: "#9a5248", fontSize: 14 }, "agent");
              s.connect(a.id, b.id, "next", "agent");
              s.connect(b.id, c.id, "done", "agent");
              message = "Built a start to process to end flowchart with connectors.";
              break;
            }
            case "checkout": {
              s.setBackground(themeBoard(), "agent");
              if (!s.brief.trim()) s.setBrief(SAMPLE_BRIEF, "agent");
              s.addElement({ kind: "text", x: 40, y: 32, width: 520, height: 32, text: "Grocery checkout", fill: "#1a1a1e", fontSize: 22 }, "agent");
              const cart = s.addElement({ kind: "ellipse", x: 40, y: 128, width: 140, height: 80, text: "Cart review", fill: "#5a9e86", stroke: "#3f7a66", fontSize: 14 }, "agent");
              const addr = s.addElement({ kind: "rectangle", x: 236, y: 136, width: 168, height: 68, text: "Delivery address", fill: "#5b7fb5", stroke: "#3f5d88", fontSize: 14 }, "agent");
              const pay = s.addElement({ kind: "rectangle", x: 460, y: 136, width: 140, height: 68, text: "Payment", fill: "#8b7cc4", stroke: "#6a5d99", fontSize: 14 }, "agent");
              const done = s.addElement({ kind: "ellipse", x: 656, y: 128, width: 148, height: 80, text: "Order success", fill: "#c46b5d", stroke: "#9a5248", fontSize: 14 }, "agent");
              s.connect(cart.id, addr.id, "next", "agent");
              s.connect(addr.id, pay.id, "next", "agent");
              s.connect(pay.id, done.id, "pay", "agent");
              message = "Built a four-step grocery checkout that matches the sample brief.";
              break;
            }
            default:
              return ok("Error: unknown template.");
          }
          s.select(null, "agent");
          return ok(message);
          } finally {
            s.endAgentBatch();
          }
        });
      },
    },
  ];
}

const controllers = new Map<string, AbortController>();
let started = false;
let lastGate = "";

function prepare(def: ToolDefinition): ToolDefinition {
  return {
    ...def,
    inputSchema: freezeSchema(def.inputSchema),
  };
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

export interface RegistrationInfo {
  modelContext: ModelContextLike;
  polyfilled: boolean;
  toolNames: string[];
}

/** Registers the CoCanvas WebMCP tool surface and keeps it in sync with board state. */
export function registerCoCanvasTools(): RegistrationInfo {
  const { modelContext, polyfilled } = ensureModelContext();

  if (!started) {
    started = true;
    syncTools(modelContext);
    useCanvasStore.subscribe((s, prev) => {
      if (gateKey(s) === gateKey(prev)) return;
      syncTools(modelContext);
    });
  }

  return {
    modelContext,
    polyfilled,
    toolNames: toolDefinitions()
      .filter((d) => isAvailable(d.name, store()))
      .map((d) => d.name),
  };
}

export { resultToText };

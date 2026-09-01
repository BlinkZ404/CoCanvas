import { useCanvasStore } from "../store/canvasStore";
import { briefTerms, reviewCanvas } from "../review/reviewCanvas";
import type { CanvasElement, ElementKind } from "../types";
import {
  ensureModelContext,
  resultToText,
  type ModelContextLike,
  type ToolDefinition,
} from "./polyfill";

const KINDS: ElementKind[] = ["frame", "rectangle", "ellipse", "text", "sticky"];

export const SAMPLE_BRIEF =
  "Grocery checkout: cart review, delivery address, payment, order success. Every step labeled. One path through.";

function store() {
  return useCanvasStore.getState();
}

function describe(el: CanvasElement) {
  return {
    id: el.id,
    kind: el.kind,
    x: Math.round(el.x),
    y: Math.round(el.y),
    width: Math.round(el.width),
    height: Math.round(el.height),
    text: el.text,
    fill: el.fill,
    stroke: el.stroke,
    fontSize: el.fontSize,
  };
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function asAgent<T>(fn: () => T): T {
  store().beginAgentTurn();
  return fn();
}

function draftFromBrief(brief: string) {
  const terms = briefTerms(brief);
  const s = store();
  s.resetView();
  s.setBackground("#f6f4ef", "agent");
  s.addElement(
    {
      kind: "text",
      x: 24,
      y: 28,
      width: 420,
      height: 28,
      text: brief.trim().slice(0, 48) || "Flow",
      fill: "#1a1a1e",
      fontSize: 18,
    },
    "agent"
  );

  const steps = terms.length ? terms.slice(0, 6) : ["Start", "Next", "End"];
  const ids: string[] = [];
  steps.forEach((label, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 24 + col * 176;
    const y = 88 + row * 140;
    const isEnd = i === 0 || i === steps.length - 1;
    const el = s.addElement(
      {
        kind: isEnd ? "ellipse" : "rectangle",
        x,
        y,
        width: isEnd ? 120 : 132,
        height: isEnd ? 72 : 64,
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
}

/**
 * The full WebMCP tool surface for CoCanvas. Every tool mutates or reads the same
 * shared canvas store that the human UI uses, so people and agents collaborate
 * on one live document. All agent-driven actions are tagged actor: "agent" so
 * they appear attributed in the activity feed.
 */
function toolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "get_brief",
      title: "Get the design brief",
      description:
        "Read the job on this board: the brief the human wrote. Call this before drafting or reviewing so you know what the flow must cover.",
      annotations: { readOnlyHint: true },
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
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const s = store();
        const counts: Record<string, number> = {};
        for (const e of s.elements) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
        const selected = s.elements.find((e) => e.id === s.selectedId) ?? null;
        return ok(
          JSON.stringify(
            {
              brief: s.brief,
              totalElements: s.elements.length,
              countsByKind: counts,
              connectors: s.connectors.length,
              openPins: s.pins.filter((p) => !p.resolved).length,
              background: s.background,
              selectedId: s.selectedId,
              selected: selected ? describe(selected) : null,
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
        "List every element currently on the canvas with its id, kind, position, size, text, and colors. Use this to find the id of an element you want to update, move, connect, pin, or delete.",
      annotations: { readOnlyHint: true },
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
        return ok(JSON.stringify(els.map(describe), null, 2));
      },
    },
    {
      name: "review_canvas",
      title: "Review the board against the brief",
      description:
        "Run the page's own design review. Returns structured findings: brief gaps (required terms missing from labels), unlabeled shapes, orphan nodes, missing start or end, overlaps, and open pins. Use this after drafting. Then pin_element on the nodes that need work, or add the missing steps.",
      annotations: { readOnlyHint: true },
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
      annotations: { readOnlyHint: true },
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
        return ok(JSON.stringify(pins, null, 2));
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
      title: "Undo the last agent change",
      description:
        "Revert the most recent agent turn (one tool call, including multi-step drafts). Use this if a draft went wrong. The human can also undo from the toolbar.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const undone = store().undoAgent();
        return ok(undone ? "Reverted the last agent change." : "Nothing to undo.");
      },
    },
    {
      name: "add_element",
      title: "Add an element",
      description:
        "Add one element to the canvas: 'frame' (artboard/container), 'rectangle' or 'ellipse' (shapes), 'text' (heading/label), or 'sticky' (sticky note). Returns the created element with its new id. Any omitted field uses a sensible default. The canvas is a fixed frame, so keep x roughly 0 to 560 and y roughly 0 to 440 to keep elements in view.",
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
        "Move an element to an absolute position (x, y) in canvas pixels. Use list_elements to find ids and current positions. Keep x roughly 0 to 560 and y roughly 0 to 440 so the element stays within the visible frame.",
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
      name: "delete_element",
      title: "Delete an element",
      description: "Delete an element from the canvas by id, along with any connectors and pins attached to it.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      execute: (input: { id: string }) => {
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
        "Remove all elements, connectors, and pins from the canvas to start fresh. The brief stays. Use with care; the human can undo this agent turn.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
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
        "Compose a complete starter layout from primitives in one call. Templates: 'login', 'kanban', 'flowchart', 'checkout' (grocery checkout with all brief steps). Prefer draft_from_brief when a brief is already set.",
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
                const fx = 20 + i * 170;
                s.addElement({ kind: "frame", x: fx, y: 48, width: 156, height: 392, text: col.title, fill: "#fffcf7", stroke: "#d8d3c8" }, "agent");
                s.addElement({ kind: "sticky", x: fx + 14, y: 100, width: 128, height: 86, text: `${col.title} card`, fill: col.fill, stroke: col.stroke, fontSize: 13 }, "agent");
              });
              message = "Built a three-column kanban board.";
              break;
            }
            case "flowchart": {
              s.setBackground("#f6f4ef", "agent");
              s.addElement({ kind: "text", x: 24, y: 40, width: 280, height: 28, text: "User journey", fill: "#1a1a1e", fontSize: 20 }, "agent");
              const a = s.addElement({ kind: "ellipse", x: 24, y: 132, width: 108, height: 80, text: "Start", fill: "#5a9e86", stroke: "#3f7a66", fontSize: 15 }, "agent");
              const b = s.addElement({ kind: "rectangle", x: 176, y: 140, width: 124, height: 64, text: "Process", fill: "#5b7fb5", stroke: "#3f5d88", fontSize: 15 }, "agent");
              const c = s.addElement({ kind: "ellipse", x: 344, y: 132, width: 108, height: 80, text: "End", fill: "#c46b5d", stroke: "#9a5248", fontSize: 15 }, "agent");
              s.connect(a.id, b.id, "next", "agent");
              s.connect(b.id, c.id, "done", "agent");
              message = "Built a start to process to end flowchart with connectors.";
              break;
            }
            case "checkout": {
              s.setBackground("#f6f4ef", "agent");
              if (!s.brief.trim()) s.setBrief(SAMPLE_BRIEF, "agent");
              const title = s.addElement({ kind: "text", x: 24, y: 28, width: 360, height: 28, text: "Grocery checkout", fill: "#1a1a1e", fontSize: 20 }, "agent");
              void title;
              const cart = s.addElement({ kind: "ellipse", x: 20, y: 120, width: 118, height: 76, text: "Cart review", fill: "#5a9e86", stroke: "#3f7a66", fontSize: 13 }, "agent");
              const addr = s.addElement({ kind: "rectangle", x: 160, y: 126, width: 132, height: 64, text: "Delivery address", fill: "#5b7fb5", stroke: "#3f5d88", fontSize: 13 }, "agent");
              const pay = s.addElement({ kind: "rectangle", x: 314, y: 126, width: 118, height: 64, text: "Payment", fill: "#8b7cc4", stroke: "#6a5d99", fontSize: 13 }, "agent");
              const done = s.addElement({ kind: "ellipse", x: 454, y: 120, width: 118, height: 76, text: "Order success", fill: "#c46b5d", stroke: "#9a5248", fontSize: 13 }, "agent");
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
        });
      },
    },
  ];
}

let registered = false;

export interface RegistrationInfo {
  modelContext: ModelContextLike;
  polyfilled: boolean;
  toolNames: string[];
}

/** Registers the CoCanvas WebMCP tool surface exactly once. */
export function registerCoCanvasTools(): RegistrationInfo {
  const { modelContext, polyfilled } = ensureModelContext();
  const defs = toolDefinitions();

  if (!registered) {
    for (const def of defs) {
      modelContext.registerTool(def);
    }
    registered = true;
  }

  return {
    modelContext,
    polyfilled,
    toolNames: defs.map((d) => d.name),
  };
}

export { resultToText };

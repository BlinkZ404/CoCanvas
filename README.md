# CoCanvas

A product-flow canvas where a human and an AI agent share one live document.

The page is the contract. You write the job in a brief. The agent drafts on the same board, using [WebMCP](https://webmachinelearning.github.io/webmcp/) tools registered on `document.modelContext`. The page can then review that draft against the brief and pin gaps on the real elements, not in a chat transcript.

Built for the [OpenAI WebMCP Challenge](https://webmcp.devpost.com).

## Who it is for

Product managers and workshop facilitators who map a checkout, onboarding, or support path on a board while an agent sits in the same room. Describing "move that box 40px and connect it to payment" in chat is the wrong interface. Pointing at the board is the right one.

## What you and an agent can do together

1. Write a brief on the board ("grocery checkout: cart, address, payment, success").
2. Ask the agent to draft. It creates labeled nodes and connectors in the live store.
3. Run `review_canvas`. The page, not the model, checks brief coverage, unlabeled shapes, orphans, missing start or end, and overlaps.
4. The agent pins the gap on the actual node. You drag, relabel, or add the missing step.
5. Undo the last agent turn if the draft is wrong.

Human edits (toolbar, drag, inspector) and agent edits (WebMCP tools) mutate the same zustand store. Activity is tagged You or Agent.

## WebMCP tools

The page registers a 20-tool surface via `document.modelContext.registerTool()`. Read tools are marked `readOnlyHint: true`.

| Tool | Role |
| --- | --- |
| `get_brief` | Read the job on the board. |
| `get_canvas_summary` | Counts, brief, open pins, selection. |
| `list_elements` | Every element with id, geometry, and labels. |
| `review_canvas` | Structured findings against the brief. |
| `list_pins` | Open and resolved critique pins. |
| `set_brief` | Write or replace the job. |
| `draft_from_brief` | Draft a connected flow from the brief. |
| `pin_element` | Leave a visible pin on an element. |
| `resolve_pin` | Mark a pin done. |
| `undo_last` | Revert the last agent turn. |
| `add_element` / `update_element` / `move_element` / `delete_element` | Primitive edits. |
| `select_element` | Point at a node so the human sees it. |
| `connect_elements` | Labeled arrows. |
| `arrange_grid` / `set_background` / `clear_canvas` | Layout helpers. |
| `create_layout` | Starter templates: login, kanban, flowchart, checkout. |

A small polyfill installs `document.modelContext` only when no native implementation exists (ChatGPT's in-app browser, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`). The in-page Agent panel calls `getTools()` and `executeTool()` the same way a real agent does.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

Try **Find the gap** in the Agent panel. It sets a grocery-checkout brief, drafts an incomplete path, runs `review_canvas`, and pins the missing payment step.

## Stack

Vite, React, TypeScript, zustand. Static. No backend.

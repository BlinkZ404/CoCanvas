import { DESIGN_SPEC } from "./design";

export const ASTRA_URL = "https://openai.com/index/gpt-6-astra/";

export const CONNECT_HINT =
  "ChatGPT desktop on GPT-5.6 Sol or Terra. Open this URL in the built-in browser, not a Codex preview. Site tools should show in the address bar. Chrome 149+ with the WebMCP flag also works.";

export type LibraryKind = "prompt" | "demo";

export type LibraryPrompt = {
  id: string;
  kind: LibraryKind;
  title: string;
  hint: string;
  /** Written into the brief bar when you copy. Empty means leave the brief alone. */
  brief: string;
  /** Full ask to paste into ChatGPT. */
  prompt: string;
};

/** Short rules for the on-page demo jobs. Not the Astra product-map spec. */
export const DEMO_SPEC =
  "This is a flow, not a product map. Nodes plus arrows. One path. Two fills plus one accent. ASCII copy. No rainbow cards.";

export const FRONTIER_BRIEF =
  "Frontier ranking: GPT-6 Astra, Claude Fable 5.1, GPT-5.6 Sol, Gemini 3.8 Flash, Grok 4.6. Lab and role on each row. Sketch, not a settled leaderboard.";

export const ASTRA_BRIEF =
  "GPT-6 Astra map: hub, capabilities, who gets it (Plus, Pro, Business, Enterprise), API gpt-6-astra, price, FrontierMath, ARC-AGI-3, OSWorld, rollout. Pin Enterprise off by default.";

export const CHATGPT_BRIEF =
  "ChatGPT login: welcome back, email address, continue, Google, Apple, Microsoft. One column. Match the live site.";

export const MODELS_BRIEF =
  "GPT-5.6 on ChatGPT desktop: Sol and Terra have Site tools. Luna and Light do not. Only Sol and Terra reach CoCanvas.";

export const SAMPLE_BRIEF =
  "Grocery checkout: cart review, delivery address, payment, order success. Every step labeled. One path through.";

export const LOOP_BRIEF =
  "CoCanvas loop: brief, page tools, live board, review, pin. Human and agent edit the same document.";

export const PROMPT_LIBRARY: LibraryPrompt[] = [
  {
    id: "frontier",
    kind: "prompt",
    title: "Astra from the source",
    hint: "The ChatGPT prompt. Open the OpenAI post. Draw a map. Pin what is still rolling out.",
    brief: ASTRA_BRIEF,
    prompt:
      `Open ${ASTRA_URL}. If you cannot open it, search for the OpenAI GPT-6 Astra announcement and use that page. Then draw a product map on this CoCanvas board. Not a chat essay. Not a typeset table.

${DESIGN_SPEC}

Set a brief that names GPT-6 Astra, capabilities, who gets it, the API name gpt-6-astra, price, FrontierMath, ARC-AGI-3, OSWorld, and rollout. Title at the top. GPT-6 Astra as a compact hub ellipse, about 320 by 100, centered over the four children. Do not stretch the hub to the width of the row. Arrows may bend. Four arrows only, all from the hub: to Capabilities, to Who, to API, to Rollout. Do not connect those four to each other. A side arrow into Rollout or Capabilities is wrong. Capabilities lists computer use, browsing, and any other job the page names. Who lists Plus, Pro, Business, Enterprise on the line under the heading. API lists gpt-6-astra and the in/out price on the line under API. Rollout lists who has it now and that Enterprise is off by default. Every node: heading, newline, then the facts. Under that, a charcoal bar for every cited score on the page (FrontierMath, ARC-AGI-3, OSWorld, and any other with a number). Do not put arrows on the score bars or their labels. Leave 32px between nodes. Do not drop free text on arrows. If you only set type on hairlines, you failed. ASCII copy only: hyphen or period, never an em dash. Do not invent a number. If a score is not on the page, pin that you could not verify it. Pin what is still rolling out, including Enterprise off by default. Do not draw exploit steps. Start with get_brief and get_canvas_summary. Call review_canvas when you are done, then delete any side arrow or score-bar arrow and shrink a stretched hub.`,
  },
  {
    id: "gap",
    kind: "demo",
    title: "Find the gap",
    hint: "Skip payment. Let the page catch it.",
    brief: SAMPLE_BRIEF,
    prompt:
      `This is a short demo on this CoCanvas board. Same beat as the Find the gap button on this page. Set a grocery checkout brief that requires cart review, delivery address, payment, and order success. Clear the board if it is something else. Draw only cart, address, and success as one path. Call review_canvas. Pin the missing payment on the success node. Do not add payment unless I ask. The page should find the gap.

${DEMO_SPEC}

Start with get_brief and get_canvas_summary.`,
  },
  {
    id: "review",
    kind: "demo",
    title: "Tighten this board",
    hint: "Critique what is already here.",
    brief: "",
    prompt:
      `Do not clear this board. Call get_brief, get_canvas_summary, and review_canvas. If the board is rainbow cards or a typeset table of labels, rebuild it as a diagram without losing the facts: void paper, nodes plus connectors, charcoal score bars if there are numbers, ASCII copy. If facts sit as free text on arrows, turn them into nodes and space them. Delete any arrow between sibling topic nodes (Capabilities into Who, API into Rollout). Delete any arrow on a score bar or score label. If the hub is stretched across the child row, shrink it to about 320 by 100 and leave the arrows. The page will bend them. Fix every overlap. Do not keep hairline rows as the whole design.

${DESIGN_SPEC}

Select the weakest node so I can see it. Pin what is wrong, missing, or unverified. Fix only what the review asked for. Align if it is messy. Stop when I could export a PNG.`,
  },
  {
    id: "loop",
    kind: "demo",
    title: "How this page works",
    hint: "Draw the product loop.",
    brief: LOOP_BRIEF,
    prompt:
      `You are inside CoCanvas. Draw how this page works as a product flow: a human writes a brief, ChatGPT calls page tools, nodes appear on the live board, review_canvas finds gaps, pins sit on real nodes, the human undoes or exports. One path. Label steps with the real tool names where it helps.

${DEMO_SPEC}

This board should explain the product to a stranger in one glance. Start with get_brief and get_canvas_summary. Call review_canvas when it reads as a map.`,
  },
];

export function libraryOf(kind: LibraryKind): LibraryPrompt[] {
  return PROMPT_LIBRARY.filter((row) => row.kind === kind);
}

export const CHATGPT_PROMPT = PROMPT_LIBRARY[0].prompt;

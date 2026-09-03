export const LIVE_URL = "https://cocanvas-beta.vercel.app";

export const CONNECT_HINT =
  "ChatGPT desktop on GPT-5.6 Sol or Terra. Chrome 149+ with the WebMCP flag also works.";

export const CHATGPT_PROMPT =
  "You are on CoCanvas. Call get_brief and get_canvas_summary first. If the brief is empty, set_brief to: Grocery checkout with cart review, delivery address, payment, and order success. Then draft_from_brief. Then review_canvas. If a step is missing, add it, connect it, and pin_element on the node that still needs work.";

/** Short asks a connected agent can run on this board. */
export const AGENT_PROMPTS = [
  "Draft this board from the brief",
  "Find the missing step and pin it",
  "Review the board against the brief",
  "Build a login screen",
  "Lay out a kanban board",
  "Sketch a start-to-end flowchart",
] as const;

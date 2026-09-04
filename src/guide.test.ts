import { describe, expect, it } from "vitest";
import { CHATGPT_PROMPT, PROMPT_LIBRARY, SAMPLE_BRIEF, libraryOf } from "./guide";

describe("PROMPT_LIBRARY", () => {
  it("keeps Astra as the ChatGPT prompt and three short demos", () => {
    expect(PROMPT_LIBRARY.map((p) => p.id)).toEqual(["frontier", "gap", "review", "loop"]);
    expect(PROMPT_LIBRARY.map((p) => p.kind)).toEqual(["prompt", "demo", "demo", "demo"]);
    expect(libraryOf("prompt")).toHaveLength(1);
    expect(libraryOf("demo")).toHaveLength(3);
    expect(PROMPT_LIBRARY[0].prompt).toBe(CHATGPT_PROMPT);
    expect(PROMPT_LIBRARY.find((p) => p.id === "gap")?.brief).toBe(SAMPLE_BRIEF);
    expect(PROMPT_LIBRARY.find((p) => p.id === "gap")?.title).toMatch(/Find the gap/);
    expect(PROMPT_LIBRARY.find((p) => p.id === "review")?.brief).toBe("");
    for (const row of PROMPT_LIBRARY) {
      expect(row.title.length).toBeGreaterThan(3);
      expect(row.hint.length).toBeGreaterThan(8);
      expect(row.hint).not.toMatch(/README/i);
      expect(row.prompt).toMatch(/get_canvas_summary|review_canvas/);
      expect(row.prompt).not.toMatch(/create_layout|README demo/);
      expect(row.prompt).not.toMatch(/^Use the page tools|^Do not look for/i);
      expect(row.prompt).not.toMatch(/[\u2012-\u2015\u2018\u2019\u201C\u201D]/);
    }
    expect(PROMPT_LIBRARY[0].prompt).toMatch(/openai\.com\/index\/gpt-6-astra/);
    expect(PROMPT_LIBRARY[0].title).toMatch(/Astra from the source/);
    expect(PROMPT_LIBRARY[0].prompt).toMatch(/#0a0a0a/);
    expect(PROMPT_LIBRARY[0].prompt).toMatch(/product map/);
    expect(PROMPT_LIBRARY[0].prompt).toMatch(/Four arrows only/);
    expect(PROMPT_LIBRARY[0].prompt).toMatch(/Do not put arrows on the score/);
    expect(PROMPT_LIBRARY[0].prompt).toMatch(/Capabilities/);
    expect(PROMPT_LIBRARY[0].prompt).toMatch(/OSWorld/);
    expect(PROMPT_LIBRARY[0].prompt).toMatch(/32px/);
    expect(PROMPT_LIBRARY[0].prompt).toMatch(/newline/);
    expect(PROMPT_LIBRARY[0].prompt).toMatch(/em dash/);
    expect(PROMPT_LIBRARY[0].prompt).toMatch(/compact hub/);
    expect(PROMPT_LIBRARY.find((p) => p.id === "review")?.prompt).toMatch(/rebuild it as a diagram/);
    expect(PROMPT_LIBRARY.find((p) => p.id === "review")?.prompt).toMatch(/sibling topic nodes/);
    expect(PROMPT_LIBRARY.find((p) => p.id === "review")?.prompt).toMatch(/score bar or score label/);
    expect(PROMPT_LIBRARY.find((p) => p.id === "review")?.prompt).toMatch(/Do not clear/);
    expect(PROMPT_LIBRARY.find((p) => p.id === "review")?.prompt).toMatch(/stretched/);
    expect(PROMPT_LIBRARY.find((p) => p.id === "gap")?.prompt).toMatch(/Do not add payment/);
    expect(PROMPT_LIBRARY.find((p) => p.id === "gap")?.prompt).toMatch(/short demo/);
    expect(PROMPT_LIBRARY.find((p) => p.id === "loop")?.prompt).toMatch(/review_canvas/);
  });
});

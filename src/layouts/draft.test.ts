import { beforeEach, describe, expect, it } from "vitest";
import { persistThemePref } from "../theme";
import { DARK_BOARD } from "../theme";
import { useCanvasStore } from "../store/canvasStore";
import { CHATGPT_BRIEF, FRONTIER_BRIEF, SAMPLE_BRIEF } from "../guide";
import { briefPhrases, sketchFromBrief } from "./draft";

describe("sketchFromBrief", () => {
  beforeEach(() => {
    useCanvasStore.getState().clearAll("human");
    persistThemePref("light");
  });

  it("turns a journey brief into a connected flow", () => {
    const ids = sketchFromBrief(SAMPLE_BRIEF, useCanvasStore.getState());
    const s = useCanvasStore.getState();
    expect(ids.length).toBeGreaterThan(3);
    expect(s.elements.some((e) => /grocery checkout/i.test(e.text))).toBe(true);
    expect(s.elements.some((e) => /cart review/i.test(e.text))).toBe(true);
    expect(s.connectors.length).toBeGreaterThan(0);
  });

  it("stacks a login brief as a screen, not a flowchart", () => {
    sketchFromBrief(CHATGPT_BRIEF, useCanvasStore.getState());
    const s = useCanvasStore.getState();
    expect(s.elements.some((e) => /welcome back/i.test(e.text))).toBe(true);
    expect(s.elements.some((e) => /email address/i.test(e.text))).toBe(true);
    expect(s.connectors).toHaveLength(0);
  });

  it("keeps version numbers when splitting a ranking brief", () => {
    expect(briefPhrases(FRONTIER_BRIEF)).toEqual(
      expect.arrayContaining(["GPT-6 Astra", "Claude Fable 5.1", "GPT-5.6 Sol", "Gemini 3.8 Flash", "Grok 4.6"])
    );
  });

  it("numbers a ranking brief from the names in the brief", () => {
    sketchFromBrief(FRONTIER_BRIEF, useCanvasStore.getState());
    const labels = useCanvasStore.getState().elements.map((e) => e.text);
    expect(labels).toEqual(expect.arrayContaining(["1", "GPT-6 Astra", "Claude Fable 5.1"]));
  });

  it("follows the chrome theme for the paper", () => {
    persistThemePref("dark");
    sketchFromBrief("Start, process, end", useCanvasStore.getState());
    expect(useCanvasStore.getState().background.toLowerCase()).toBe(DARK_BOARD);
  });
});

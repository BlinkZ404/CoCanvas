import { describe, expect, it } from "vitest";
import { ensureModelContext, resultToText, type ModelContextLike } from "./polyfill";

describe("resultToText", () => {
  it("joins content blocks and stringifies leftovers", () => {
    expect(resultToText("ok")).toBe("ok");
    expect(resultToText({ content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] })).toBe("a\nb");
  });
});

describe("ensureModelContext", () => {
  it("keeps a private polyfill and can register plus execute a tool", async () => {
    delete (document as unknown as { modelContext?: ModelContextLike }).modelContext;
    const { modelContext, polyfilled } = ensureModelContext();
    expect(polyfilled).toBe(true);
    expect(modelContext.__isPolyfill).toBe(true);
    expect((document as unknown as { modelContext?: ModelContextLike }).modelContext).toBeUndefined();

    await modelContext.registerTool({
      name: "echo",
      description: "Echo the text",
      execute: (input: { text?: string }) => input.text ?? "",
    });
    const tools = await modelContext.getTools();
    expect(tools.some((t) => t.name === "echo")).toBe(true);
    await expect(modelContext.executeTool("echo", { text: "hi" })).resolves.toBe("hi");
    await expect(modelContext.executeTool("echo", "not-json")).resolves.toBe("");
    await expect(modelContext.executeTool("missing")).rejects.toThrow(/Unknown tool/);
  });

  it("prefers a native host on window over the page polyfill", () => {
    const host = {
      registerTool: () => undefined,
      getTools: () => [],
      executeTool: async () => "",
    } as unknown as ModelContextLike;
    (window as unknown as { modelContext?: ModelContextLike }).modelContext = host;
    const { modelContext, polyfilled } = ensureModelContext();
    expect(polyfilled).toBe(false);
    expect(modelContext).toBe(host);
    delete (window as unknown as { modelContext?: ModelContextLike }).modelContext;
  });

  it("rejects a bad tool name", async () => {
    const { modelContext } = ensureModelContext();
    expect(() =>
      modelContext.registerTool({
        name: "has a space",
        description: "Bad",
        execute: () => "no",
      })
    ).toThrow(/Invalid tool name/);
  });
});

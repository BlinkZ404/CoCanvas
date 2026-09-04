/**
 * Page-owned WebMCP context plus native detection.
 *
 * Native support is limited (ChatGPT's in-app browser, Chrome 149+ with
 * `chrome://flags/#enable-webmcp-testing`). The page keeps a private polyfill
 * for the Agent panel and DevTools hook. It does not occupy
 * `document.modelContext`, so a host can still inject.
 *
 * Spec: https://webmachinelearning.github.io/webmcp/
 */

export interface JSONSchema {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  consequentialHint?: boolean;
}

export type ToolResult =
  | string
  | { content: Array<{ type: "text"; text: string }> };

export interface ToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JSONSchema;
  annotations?: ToolAnnotations;
  execute: (input: any, ctx?: { signal?: AbortSignal }) => ToolResult | Promise<ToolResult>;
}

export interface RegisteredTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JSONSchema;
  annotations?: ToolAnnotations;
}

export interface RegisterOptions {
  signal?: AbortSignal;
}

export interface ModelContextLike extends EventTarget {
  registerTool(tool: ToolDefinition, options?: RegisterOptions): Promise<void> | void;
  getTools(): Promise<RegisteredTool[]> | RegisteredTool[];
  executeTool(nameOrTool: string | RegisteredTool, input?: unknown): Promise<ToolResult>;
  /** Present on the polyfill so the page can tell it from a native host. */
  __isPolyfill?: boolean;
}

const NAME_RE = /^[A-Za-z0-9_.-]{1,128}$/;

class PolyfillModelContext extends EventTarget implements ModelContextLike {
  private tools = new Map<string, ToolDefinition>();
  __isPolyfill = true;

  registerTool(tool: ToolDefinition, options?: RegisterOptions): void {
    if (!tool || typeof tool !== "object") {
      throw new TypeError("registerTool requires a tool definition object");
    }
    if (!tool.name || !NAME_RE.test(tool.name)) {
      throw new TypeError(
        `Invalid tool name "${tool.name}": 1-128 chars of [A-Za-z0-9_.-]`
      );
    }
    if (!tool.description) {
      throw new TypeError(`Tool "${tool.name}" requires a non-empty description`);
    }
    if (typeof tool.execute !== "function") {
      throw new TypeError(`Tool "${tool.name}" requires an execute() function`);
    }

    this.tools.set(tool.name, tool);

    const signal = options?.signal;
    if (signal) {
      if (signal.aborted) {
        this.tools.delete(tool.name);
      } else {
        signal.addEventListener(
          "abort",
          () => {
            this.tools.delete(tool.name);
            this.dispatchEvent(new Event("toolchange"));
          },
          { once: true }
        );
      }
    }

    this.dispatchEvent(new Event("toolchange"));
  }

  getTools(): RegisteredTool[] {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: t.annotations,
    }));
  }

  async executeTool(
    nameOrTool: string | RegisteredTool,
    input?: unknown
  ): Promise<ToolResult> {
    const name = typeof nameOrTool === "string" ? nameOrTool : nameOrTool?.name;
    const tool = name ? this.tools.get(name) : undefined;
    if (!tool) {
      throw new Error(`Unknown tool: ${String(name)}`);
    }
    const parsed =
      typeof input === "string" && input.trim().length
        ? safeParse(input)
        : input ?? {};
    const args =
      parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    const result = await tool.execute(args, {});
    return result;
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export interface EnsureResult {
  modelContext: ModelContextLike;
  polyfilled: boolean;
}

let pageContext: PolyfillModelContext | null = null;

function isHostContext(value: unknown): value is ModelContextLike {
  if (!value || typeof value !== "object") return false;
  const ctx = value as ModelContextLike;
  return typeof ctx.registerTool === "function" && !ctx.__isPolyfill;
}

/** Private polyfill for in-page tools. Not attached to `document.modelContext`. */
export function createPageModelContext(): ModelContextLike {
  if (!pageContext) pageContext = new PolyfillModelContext();
  return pageContext;
}

/**
 * Native host context if the page has one. Prefers `document.modelContext`,
 * then `navigator.modelContext`, then `window.modelContext`. Skips the
 * page polyfill so a late-injected host can still win.
 */
export function detectNativeModelContext(): ModelContextLike | undefined {
  const doc = document as unknown as { modelContext?: ModelContextLike };
  const nav = navigator as unknown as { modelContext?: ModelContextLike };
  const win = window as unknown as { modelContext?: ModelContextLike };
  if (isHostContext(doc.modelContext)) return doc.modelContext;
  if (isHostContext(nav.modelContext)) return nav.modelContext;
  if (isHostContext(win.modelContext)) return win.modelContext;
  return undefined;
}

/**
 * Returns the native host context when present, otherwise the private page
 * polyfill. Does not write to `document.modelContext`.
 */
export function ensureModelContext(): EnsureResult {
  const native = detectNativeModelContext();
  if (native) return { modelContext: native, polyfilled: false };
  return { modelContext: createPageModelContext(), polyfilled: true };
}

export function resultToText(result: ToolResult): string {
  if (typeof result === "string") return result;
  if (result && Array.isArray(result.content)) {
    return result.content.map((c) => c.text).join("\n");
  }
  return JSON.stringify(result);
}

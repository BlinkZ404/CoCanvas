/**
 * WebMCP polyfill for `document.modelContext`.
 *
 * Native support is limited (ChatGPT's in-app browser, Chrome 149+ with
 * `chrome://flags/#enable-webmcp-testing`). When that API is missing, this
 * module installs a compatible implementation so page tools still run.
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
  [key: string]: unknown;
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

/**
 * Returns the active model context, installing the polyfill on `document` when
 * no native implementation is available. Prefers `document.modelContext`, then
 * the deprecated `navigator.modelContext`.
 */
export function ensureModelContext(): EnsureResult {
  const doc = document as unknown as { modelContext?: ModelContextLike };
  const nav = navigator as unknown as { modelContext?: ModelContextLike };

  const native = doc.modelContext ?? nav.modelContext;
  if (native && typeof native.registerTool === "function") {
    return { modelContext: native, polyfilled: Boolean(native.__isPolyfill) };
  }

  const polyfill = new PolyfillModelContext();
  try {
    Object.defineProperty(document, "modelContext", {
      value: polyfill,
      configurable: true,
      writable: false,
    });
  } catch {
    (doc as { modelContext?: ModelContextLike }).modelContext = polyfill;
  }
  return { modelContext: polyfill, polyfilled: true };
}

/** Normalize any tool result into a plain string for display. */
export function resultToText(result: ToolResult): string {
  if (typeof result === "string") return result;
  if (result && Array.isArray(result.content)) {
    return result.content.map((c) => c.text).join("\n");
  }
  return JSON.stringify(result);
}

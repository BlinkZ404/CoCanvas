export {};

type CocanvasToolsHook = {
  list: () => string[];
  execute: (name: string, input?: unknown) => Promise<string>;
};

declare global {
  interface Window {
    modelContext?: unknown;
    __cocanvasTools?: CocanvasToolsHook;
  }

  interface Document {
    modelContext?: unknown;
  }

  interface Navigator {
    modelContext?: unknown;
  }
}

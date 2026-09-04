import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const webmcpHeaders = {
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy": "tools=(self)",
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    headers: webmcpHeaders,
  },
  preview: {
    host: true,
    port: 4173,
    headers: webmcpHeaders,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
  },
});

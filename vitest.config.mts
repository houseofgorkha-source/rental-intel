import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // tools/tolet-vision is a separate, self-contained Node tool with its
    // own test files written for Node's native `node:test` runner, not
    // Vitest -- without this exclude, Vitest still collects them and
    // reports "No test suite found" as a failed suite for each one.
    exclude: [...configDefaults.exclude, "tools/tolet-vision/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});

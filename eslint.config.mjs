import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // tools/tolet-vision is a separate, self-contained Node tool (its own
    // package.json says "Not part of the RentalIntel app") -- not built,
    // linted, or tested as part of this app. Without this, ESLint also
    // crawls its Python-venv-vendored JS bundles (tools/tolet-vision/.venv*)
    // and can crash with "RangeError: Invalid string length" on a huge
    // minified vendor file.
    "tools/tolet-vision/**",
  ]),
]);

export default eslintConfig;

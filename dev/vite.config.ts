/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Local-only dev harness config. NEVER shipped into the claude.ai artifact.
// Root is the repo root (one level up from this file) so the shipped
// `meeting-assistant.tsx` and `dev/` both resolve cleanly.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

export default defineConfig({
  root: repoRoot,
  plugins: [react()],
  server: { open: "/dev/index.html" },
  build: {
    outDir: resolve(here, "dist"),
    rollupOptions: { input: resolve(here, "index.html") },
  },
  test: {
    // jsdom so the in-memory window.storage shim activates and DOM-touching
    // helpers run. Pure-logic tests work fine under jsdom too.
    environment: "jsdom",
    include: ["dev/tests/**/*.test.ts"],
    globals: false,
  },
});

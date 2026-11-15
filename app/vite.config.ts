/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

export default defineConfig({
  base: "./", // relative paths so the site works under https://USER.github.io/REPO/
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: {
    port: 5173,
    open: true,
    // OneDrive folders often do not send file-change events, so the dev server misses edits. Polling fixes that.
    watch: { usePolling: true, interval: 400 },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});

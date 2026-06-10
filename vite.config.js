import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

let commit = "dev";
try {
  commit = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  /* not a git checkout */
}
const APP_VERSION = `${new Date().toISOString().slice(0, 10)} (${commit})`;

// Emits version.json alongside the build so the running app can ask
// "is there a newer deploy than me?"
const emitVersion = () => ({
  name: "emit-version",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: APP_VERSION }) });
  },
});

export default defineConfig({
  // Relative base so the build works at any URL path (e.g. GitHub Pages /dream-canvas/)
  base: "./",
  plugins: [react(), emitVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
});

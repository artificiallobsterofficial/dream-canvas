import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the build works at any URL path (e.g. GitHub Pages /dream-canvas/)
  base: "./",
  plugins: [react()],
});

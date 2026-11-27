import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// relative base so the static build can be hosted from any sub-path (e.g. GitHub Pages)
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./tests/setup.ts"] },
});

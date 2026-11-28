// Separate bundle for the offline audio measurements (not shipped with the game): npm run audio:analyze
import { defineConfig } from "vite";

export default defineConfig({
  build: { outDir: "dist-audiolab", emptyOutDir: true, lib: { entry: "src/audio/lab.ts", name: "QTA6AudioLab", formats: ["iife"], fileName: () => "audiolab.js" }, minify: false },
});

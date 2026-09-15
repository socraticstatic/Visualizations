import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

// The sandbox has no module loader, so this must emit one self-contained IIFE.
export default defineConfig({
  resolve: { alias: { "@engine": resolve(here, "../src/charts") } },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "es2020",
    lib: {
      entry: resolve(here, "src/sandbox/main.ts"),
      formats: ["iife"],
      name: "chartColorSystemPlugin",
      fileName: () => "code.js",
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

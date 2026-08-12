import { defineConfig } from "vite";
import path from "path";

/**
 * Library build for the MIT-licensed palette engine, published to npm as
 * `chart-color-system`. Separate from vite.config.ts on purpose: that one
 * builds the proprietary React app, this one must never pull it in.
 *
 * `culori` stays external so consumers dedupe it against their own copy.
 */
export default defineConfig({
  build: {
    outDir: "dist-lib",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, "src/charts/index.ts"),
      name: "ChartColorSystem",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: ["culori"],
    },
  },
});

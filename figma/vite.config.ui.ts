import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

// allowedDomains: ["none"] means the UI cannot fetch a single asset, so
// everything is inlined into one HTML file.
export default defineConfig({
  root: resolve(here, "src/ui"),
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { "@engine": resolve(here, "../src/charts") } },
  build: {
    outDir: resolve(here, "dist"),
    emptyOutDir: false,
    target: "es2020",
    rollupOptions: { input: resolve(here, "src/ui/ui.html") },
  },
});

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: { alias: { "@engine": resolve(here, "../src/charts") } },
  test: { globals: true, environment: "node", include: ["src/**/*.test.ts"] },
});

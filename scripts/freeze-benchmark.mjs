/**
 * Computes the benchmark post's solver figures once and commits them.
 *
 * Run after any change to the palette engine:
 *   npm run freeze:benchmark
 *
 * The output is checked in. That is the point: a published benchmark is a
 * measurement taken at a version on a date, and when the engine moves the
 * numbers should move in a diff somebody reads, not silently in a reader's
 * browser. See src/posts/benchmarkFacts.ts for why recomputing at render time
 * did not work.
 */
import { build } from "vite";
import { writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react-swc";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ssrDir = resolve(root, "node_modules/.cache/freeze-ssr");
const out = resolve(root, "src/posts/benchmarkFacts.json");

rmSync(ssrDir, { recursive: true, force: true });
await build({
  root,
  logLevel: "warn",
  plugins: [react()],
  resolve: { alias: { "@": resolve(root, "src") } },
  build: {
    ssr: resolve(root, "src/posts/benchmarkFacts.ts"),
    outDir: ssrDir,
    emptyOutDir: true,
    minify: false,
    rollupOptions: { output: { entryFileNames: "facts.mjs" } },
  },
});

const { computeFrozenFacts } = await import(pathToFileURL(resolve(ssrDir, "facts.mjs")).href);
const facts = computeFrozenFacts(`node ${process.version}`);

writeFileSync(out, JSON.stringify(facts, null, 2) + "\n");

console.log(`\nfrozen → src/posts/benchmarkFacts.json`);
console.log(`  engine        ${facts.engineVersion}`);
console.log(`  measured      ${facts.measuredOn} (${facts.measuredWith})`);
console.log(`  N=6 on white  ${facts.solved6.worstContrast.toFixed(2)}:1 worst contrast`);
console.log(`                ${facts.solved6.worstCvdDeltaE.toFixed(1)} worst CVD ΔE`);
console.log(`                ${facts.solved6.minPairDeltaE.toFixed(1)} min pairwise ΔE`);
console.log(`  palette       ${facts.solved6.palette.join(" ")}\n`);

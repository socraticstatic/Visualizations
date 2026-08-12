/**
 * GitHub Pages serves static files, so a direct hit on /blog/<slug> looks for a
 * directory that does not exist and 404s before React Router ever runs. Pages
 * serves 404.html for unmatched paths, so shipping a copy of the app shell
 * under that name hands the URL to the client router instead.
 *
 * Runs as `postbuild`, after vite has written dist/index.html with the correct
 * hashed asset paths.
 */
import { copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const index = resolve(root, "dist/index.html");

if (!existsSync(index)) {
  console.error("dist/index.html missing - run the app build first.");
  process.exit(1);
}

copyFileSync(index, resolve(root, "dist/404.html"));
console.log("dist/404.html written (SPA deep-link fallback)");

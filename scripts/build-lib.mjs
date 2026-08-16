/**
 * Assembles dist-lib/ into a publishable, unambiguously MIT npm package.
 *
 * The root package.json stays private and proprietary because it describes
 * the app. The published package gets its own manifest written here, so the
 * tarball can never carry a license claim that contradicts LICENSE.
 *
 * Run after `vite build --config vite.config.lib.ts` and `tsc -p tsconfig.lib.json`.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "dist-lib");

if (!existsSync(resolve(out, "index.mjs"))) {
  console.error("dist-lib/index.mjs missing — run the vite lib build first.");
  process.exit(1);
}

const appPkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

// The package version IS the palette version. A palette change that doesn't
// bump PALETTE_VERSION would ship silently different colors under the same
// npm version, so read it from the one place that already tracks it.
const versionSrc = readFileSync(resolve(root, "src/charts/version.ts"), "utf8");
const version = versionSrc.match(/PALETTE_VERSION\s*=\s*"([^"]+)"/)?.[1];
if (!version) {
  console.error("Could not read PALETTE_VERSION from src/charts/version.ts");
  process.exit(1);
}
// The app's package.json version and PALETTE_VERSION must move together —
// they drifted once (0.1.0 vs a displayed v0.7.0). Refuse to publish a
// package whose version contradicts the app that claims to be it.
if (appPkg.version !== version) {
  console.error(
    `Version drift: package.json is ${appPkg.version} but PALETTE_VERSION is ${version}. Bump both together.`
  );
  process.exit(1);
}

const pkg = {
  name: "chart-color-system",
  version,
  description:
    "Contrast-, CVD-, and grayscale-audited categorical, sequential, and diverging chart palettes, with matched dash / decal / shape encodings.",
  keywords: [
    "color",
    "palette",
    "chart",
    "dataviz",
    "data-visualization",
    "accessibility",
    "a11y",
    "wcag",
    "colorblind",
    "color-vision-deficiency",
    "cvd",
    "deuteranopia",
    "protanopia",
    "oklab",
    "echarts",
  ],
  author: appPkg.author,
  license: "MIT",
  repository: appPkg.repository,
  homepage: appPkg.homepage,
  bugs: appPkg.bugs,
  funding: appPkg.funding,
  type: "module",
  sideEffects: false,
  main: "./index.cjs",
  module: "./index.mjs",
  types: "./types/index.d.ts",
  exports: {
    ".": {
      types: "./types/index.d.ts",
      import: "./index.mjs",
      require: "./index.cjs",
    },
  },
  files: ["index.mjs", "index.cjs", "index.mjs.map", "index.cjs.map", "types", "LICENSE", "README.md"],
  peerDependencies: { culori: appPkg.dependencies.culori },
  engines: { node: ">=18" },
};

writeFileSync(resolve(out, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
copyFileSync(resolve(root, "LICENSE-MIT"), resolve(out, "LICENSE"));
copyFileSync(resolve(root, "README-lib.md"), resolve(out, "README.md"));

console.log(`dist-lib/ ready — chart-color-system@${version} (MIT)`);

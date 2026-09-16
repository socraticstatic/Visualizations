/**
 * Regenerate the golden palette sweep.
 *
 * Run this ONLY when PALETTE_VERSION is being bumped deliberately. If it is
 * needed at any other time, the solver's output moved when it should not have
 * - which is the whole point of the golden file.
 *
 *   node scripts/freeze-palette-sweep.mjs
 */
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "sweep-"));
const entry = join(dir, "entry.ts");
writeFileSync(
  entry,
  `import { solveCategorical, auditPalette, fromCss, POSTURE } from "@/charts/index";
const out = [];
for (const posture of Object.keys(POSTURE)) {
  for (let n = 1; n <= POSTURE[posture].maxCategorical; n++) {
    for (const bgHex of ["#ffffff", "#0b0e14"]) {
      const bg = fromCss(bgHex);
      const r = solveCategorical({ n, posture, background: bg, grid: fromCss("#e5e7eb"), locks: [] });
      const a = auditPalette(r.palette, bg);
      out.push([posture, n, bgHex, a.overall, r.relaxations.join("+") || "-", r.palette.map((c) => c.hex).join("")].join(","));
    }
  }
}
console.log(out.join("\\n"));`
);
const bundle = join(dir, "sweep.cjs");
execSync(
  `npx --yes esbuild@0.24.0 ${entry} --bundle --format=cjs --platform=node --alias:@=./src --outfile=${bundle} --log-level=error`,
  { stdio: "inherit" }
);
const out = execSync(`node ${bundle}`).toString().trim() + "\n";
const target = "src/charts/__tests__/__golden__/palette-sweep.csv";
const before = readFileSync(target, "utf8");
writeFileSync(target, out);
console.log(before === out ? "unchanged" : "REWRITTEN — the solver's output moved");

/**
 * Seed jsdom with the chart tokens actually shipped in src/index.css.
 *
 * getChartTheme reads CSS custom properties off the DOM, and jsdom does not
 * apply stylesheets, so tests have to seed them by hand.
 *
 * This parses the real stylesheet rather than restating the values. A
 * hand-maintained copy previously drifted badly -- it still carried the
 * single-hue sequential ramp (--chart-seq-low: 210 60% 96%) long after the
 * shipped ramp became multi-hue teal→indigo (170 65% 38%), along with stale
 * axis and target values. That meant the palette invariant suites were
 * validating a color system the application never renders.
 *
 * Parsing the source of truth makes that class of drift impossible.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS_PATH = resolve(__dirname, "../index.css");

/** All `--token: value;` pairs declared in every `:root` or `.dark` block. */
function parseBlock(css: string, selector: ":root" | ".dark"): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "g");
  for (const block of css.matchAll(re)) {
    for (const decl of block[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      out[decl[1]] = decl[2].trim();
    }
  }
  return out;
}

export interface SeededRoots {
  /** Element carrying the `.dark` class, for getChartTheme("dark", ...). */
  darkRoot: HTMLElement;
}

/**
 * Apply light tokens to documentElement and mount a `.dark` element carrying
 * the dark tokens. Call once per test file, at module scope, before anything
 * reaches getChartTheme.
 */
export function seedTokens(): SeededRoots {
  const css = readFileSync(CSS_PATH, "utf8");
  const light = parseBlock(css, ":root");
  const dark = parseBlock(css, ".dark");

  const root = document.documentElement;
  for (const [k, v] of Object.entries(light)) root.style.setProperty(k, v);

  const darkRoot = document.createElement("div");
  darkRoot.className = "dark";
  // Dark blocks only restate what changes, so start from light and override.
  for (const [k, v] of Object.entries({ ...light, ...dark })) {
    darkRoot.style.setProperty(k, v);
  }
  document.body.appendChild(darkRoot);
  return { darkRoot };
}

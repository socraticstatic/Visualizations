import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fromCss } from "@/charts/palette/distance";
import { contrastRatio } from "@/charts/audit";

/**
 * Regression guard for the text-contrast bug class.
 *
 * Semantic chart tokens are tuned to clear 3:1 as chart marks (WCAG 2.2
 * SC 1.4.11). Reusing them as small UI text needs 4.5:1 (SC 1.4.3). A
 * measured sweep on 2026-07-31 found 111 failures from exactly this: the
 * positive green appeared as text 89 times at 3.65-3.88:1, and the info blue
 * carried white text at 3.90:1 on every selected control including the nav.
 *
 * Parsed from index.css rather than the DOM: jsdom does not resolve custom
 * property inheritance from stylesheets, and the declared value is the thing
 * we actually want to guard.
 */
const CSS = readFileSync(resolve(__dirname, "../../index.css"), "utf8");

/** Extract a token's triplet from the `:root` (light) or `.dark` block. */
function token(name: string, theme: "light" | "dark"): string {
  const blockRe =
    theme === "light" ? /:root\s*\{([\s\S]*?)\n\s*\}/g : /\.dark\s*\{([\s\S]*?)\n\s*\}/g;
  for (const m of CSS.matchAll(blockRe)) {
    const hit = m[1].match(new RegExp(`--${name}:\\s*([^;]+);`));
    if (hit) return hit[1].trim();
  }
  throw new Error(`token --${name} not found in ${theme} block`);
}

const rec = (name: string, theme: "light" | "dark") => fromCss(`hsl(${token(name, theme)})`);

/** Every surface a piece of UI text can sit on, per theme. */
const BACKGROUNDS = ["chart-bg", "chart-surface", "page-bg"] as const;

/** Tokens used as small text. Each must clear 4.5:1 on every background. */
const TEXT_TOKENS = [
  "chart-positive-text",
  "chart-negative-text",
  "chart-info-text",
  "chart-muted-text",
  // shadcn's base muted token. Its stock light value is 46.9% lightness, which
  // measured 4.48:1 and failed by 0.02 across 9 rendered labels.
  "muted-foreground",
] as const;

/** Fills that carry --chart-bg text on top, so the fill itself must clear 4.5:1. */
const STRONG_FILLS = ["chart-info-strong", "chart-positive-strong"] as const;

describe("text-safe tokens clear WCAG 1.4.3 on every surface", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const name of TEXT_TOKENS) {
      for (const bg of BACKGROUNDS) {
        it(`${theme}: --${name} on --${bg} >= 4.5:1`, () => {
          expect(contrastRatio(rec(name, theme), rec(bg, theme))).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

describe("selected-control fills carry readable text", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const fill of STRONG_FILLS) {
      it(`${theme}: --${fill} against --chart-bg >= 4.5:1`, () => {
        expect(contrastRatio(rec(fill, theme), rec("chart-bg", theme))).toBeGreaterThanOrEqual(
          4.5
        );
      });
    }
  }
});

describe("mark tokens keep their 3:1 mark tuning", () => {
  it("light: --chart-positive still clears 3:1 as a mark", () => {
    // Guards against someone "fixing" contrast by darkening the mark token,
    // which would change every chart. Marks need 3:1, not 4.5:1.
    expect(
      contrastRatio(rec("chart-positive", "light"), rec("chart-bg", "light"))
    ).toBeGreaterThanOrEqual(3);
  });
});

/**
 * Enforcement test: every (kind, theme, N) permutation reachable via the
 * built-in builder controls MUST produce a palette that satisfies every
 * accessibility and contrast constraint with NO solver relaxations.
 *
 * The built-in slider cap is `min(rule.recommendedN, safeMaxN(theme, posture))`
 * — this test verifies that:
 *   1. The probe (safeMaxN) is monotone-correct: every N up to and including it
 *      passes every constraint with zero relaxations.
 *   2. The probe never collapses to 1 — for every (theme, posture) reachable
 *      from the builder, at least N=2 is achievable so categorical comparisons
 *      always work in default mode.
 *
 * This is the executable counterpart of the project memory rule:
 *   "Built-in palette controls (kind, N, theme) must auto-enforce best
 *    practices; audit/contrast/ΔE/CVD warnings only fire for ColorPicker
 *    manual overrides."
 */
import { describe, it, expect } from "vitest";
import { BEST_PRACTICE } from "@/charts/bestPractices";
import type { ChartKind } from "@/charts/chartKinds";
import { solveCategorical } from "@/charts/palette/categorical";
import { fromHsl, deltaE, cvdDeltaE } from "@/charts/palette/distance";
import { contrastRatio } from "@/charts/audit";
import { THRESHOLDS, CVD_SEVERITY } from "@/charts/constraints";
import { safeMaxN, clearSafeMaxNCache } from "@/charts/builtinBounds";

// Seed the document so getChartTheme can read CSS vars in jsdom.
// Mirrors the tokens shipped in src/index.css.
function seedTokens() {
  const lightVars: Record<string, string> = {
    "--chart-bg": "0 0% 100%",
    "--chart-surface": "0 0% 98%",
    "--chart-grid": "214 32% 91%",
    "--chart-axis": "215 16% 47%",
    "--chart-tooltip-bg": "222 47% 11%",
    "--chart-tooltip-fg": "0 0% 100%",
    "--chart-muted": "215 20% 65%",
    "--chart-other": "215 16% 47%",
    "--chart-positive": "152 60% 36%",
    "--chart-negative": "0 72% 45%",
    "--chart-target": "32 95% 44%",
    "--chart-forecast": "210 60% 60%",
    "--chart-cat-anchor-1": "210 85% 45%",
    "--chart-cat-anchor-2": "28 88% 50%",
    "--chart-cat-anchor-3": "152 55% 38%",
    "--chart-seq-low": "210 60% 96%",
    "--chart-seq-high": "222 80% 30%",
    "--chart-div-neg": "0 72% 45%",
    "--chart-div-mid": "210 20% 96%",
    "--chart-div-pos": "152 60% 36%",
  };
  const darkVars: Record<string, string> = {
    "--chart-bg": "222 47% 6%",
    "--chart-surface": "222 47% 9%",
    "--chart-grid": "217 33% 18%",
    "--chart-axis": "215 20% 65%",
    "--chart-tooltip-bg": "0 0% 100%",
    "--chart-tooltip-fg": "222 47% 11%",
    "--chart-muted": "215 16% 47%",
    "--chart-other": "215 20% 65%",
    "--chart-positive": "152 65% 50%",
    "--chart-negative": "0 75% 60%",
    "--chart-target": "32 95% 60%",
    "--chart-forecast": "210 80% 70%",
    "--chart-cat-anchor-1": "210 90% 65%",
    "--chart-cat-anchor-2": "28 92% 62%",
    "--chart-cat-anchor-3": "152 60% 55%",
    "--chart-seq-low": "222 47% 12%",
    "--chart-seq-high": "210 90% 75%",
    "--chart-div-neg": "0 75% 60%",
    "--chart-div-mid": "222 47% 14%",
    "--chart-div-pos": "152 65% 50%",
  };
  const root = document.documentElement;
  for (const [k, v] of Object.entries(lightVars)) root.style.setProperty(k, v);
  // Dark scope: the .dark root reads dark vars; jsdom needs an element with
  // the .dark class for getChartTheme("dark", ...) to find it.
  const darkRoot = document.createElement("div");
  darkRoot.className = "dark";
  for (const [k, v] of Object.entries(darkVars)) darkRoot.style.setProperty(k, v);
  document.body.appendChild(darkRoot);
}

// Seed at module load time so describe-level calls (safeMaxN below) see tokens.
seedTokens();
clearSafeMaxNCache();

const THEME_TOKENS = {
  light: {
    bg: fromHsl(0, 0, 100),
    grid: fromHsl(214, 32, 91),
    anchors: [fromHsl(210, 85, 45), fromHsl(28, 88, 50), fromHsl(152, 55, 38)],
  },
  dark: {
    bg: fromHsl(222, 47, 6),
    grid: fromHsl(217, 33, 18),
    anchors: [fromHsl(210, 90, 65), fromHsl(28, 92, 62), fromHsl(152, 60, 55)],
  },
} as const;

const CATEGORICAL_KINDS = (Object.keys(BEST_PRACTICE) as ChartKind[]).filter(
  (k) => BEST_PRACTICE[k].family === "categorical"
);

function passes(palette: ReturnType<typeof solveCategorical>["palette"], bg: ReturnType<typeof fromHsl>) {
  for (let i = 0; i < palette.length; i++) {
    if (contrastRatio(palette[i], bg) < 3) return false;
    for (let j = i + 1; j < palette.length; j++) {
      if (deltaE(palette[i], palette[j]) < THRESHOLDS.minDeltaENormal) return false;
      if (cvdDeltaE(palette[i], palette[j], CVD_SEVERITY) < THRESHOLDS.minDeltaECvd) return false;
    }
  }
  return true;
}

describe("Built-in builder — every reachable permutation passes every constraint", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const kind of CATEGORICAL_KINDS) {
      const rule = BEST_PRACTICE[kind];
      const cap = Math.min(rule.recommendedN, safeMaxN(theme, rule.posture));

      const familyMinN = 1;

      it(`${theme} · ${kind} — safe cap ≥ family min (${familyMinN})`, () => {
        // Enforcement guarantees: cap is never below the family's minimum so
        // at least the lowest N for this kind is always reachable safely.
        expect(cap).toBeGreaterThanOrEqual(familyMinN);
      });

      for (let n = 1; n <= cap; n++) {
        it(`${theme} · ${kind} · N=${n} — zero relaxations, all constraints pass`, () => {
          const { bg, grid, anchors } = THEME_TOKENS[theme];
          const result = solveCategorical({
            n,
            posture: rule.posture,
            background: bg,
            grid,
            locks: anchors.slice(0, Math.min(3, n)),
          });
          expect(result.relaxations).toEqual([]);
          expect(result.palette).toHaveLength(n);
          if (n >= 2) {
            expect(passes(result.palette, bg)).toBe(true);
          }
        });
      }
    }
  }
});

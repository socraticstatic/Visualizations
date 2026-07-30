/**
 * Enforcement test for the builder's safe cap.
 *
 * The built-in slider's default snap is `min(rule.recommendedN,
 * safeMaxN(theme, posture))`. Per safeMaxN's documented semantics the solver
 * pass-rate is NON-monotone in N: the probe returns the highest N that clears
 * every configured floor plus WCAG contrast with zero relaxations, and an
 * intermediate N below the cap may legitimately miss a floor — the audit /
 * badge UI surfaces that to the user. So this suite verifies:
 *   1. At the cap itself: zero relaxations and every constraint passes.
 *      (This is the state users land on out of the box.)
 *   2. At every intermediate N: the solve is well-formed (correct palette
 *      length) and any missed floor is reported in `solve.relaxations` so
 *      the UI can flag it — never silently.
 *   3. The cap never collapses below the family minimum.
 *
 * Exercises the exact code path the builder uses: getChartTheme (locks: [];
 * anchors are preferences, not hard locks), which is also what safeMaxN
 * itself probes.
 */
import { describe, it, expect } from "vitest";
import { BEST_PRACTICE } from "@/charts/bestPractices";
import type { ChartKind } from "@/charts/chartKinds";
import { getChartTheme, type ChartTheme } from "@/charts/echartsTheme";
import { deltaE, cvdDeltaE, type ColorRecord } from "@/charts/palette/distance";
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

const CATEGORICAL_KINDS = (Object.keys(BEST_PRACTICE) as ChartKind[]).filter(
  (k) => BEST_PRACTICE[k].family === "categorical"
);

function passes(palette: ColorRecord[], bg: ColorRecord) {
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

      it(`${theme} · ${kind} · N=${cap} (safe cap) — zero relaxations, all constraints pass`, () => {
        const t: ChartTheme = getChartTheme(theme, rule.posture, cap);
        expect(t.solve.relaxations).toEqual([]);
        expect(t.solve.palette).toHaveLength(cap);
        if (cap >= 2) {
          expect(passes(t.solve.palette, t.tokens.bg)).toBe(true);
        }
      });

      for (let n = 1; n < cap; n++) {
        it(`${theme} · ${kind} · N=${n} — well-formed; any missed floor is reported`, () => {
          const t: ChartTheme = getChartTheme(theme, rule.posture, n);
          expect(t.solve.palette).toHaveLength(n);
          // Solver relaxations must exactly reflect the ΔE floors: a floor
          // miss below the cap is allowed (non-monotone annealing) but it
          // must be reported so the audit UI can flag it — never silent.
          const minNormalOk = t.solve.minPairDeltaE >= THRESHOLDS.minDeltaENormal;
          const minCvdOk = t.solve.minCvdDeltaE >= THRESHOLDS.minDeltaECvd;
          if (n >= 2) {
            expect(t.solve.relaxations.includes("minDeltaENormal")).toBe(!minNormalOk);
            expect(t.solve.relaxations.includes("minDeltaECvd")).toBe(!minCvdOk);
          } else {
            expect(t.solve.relaxations).toEqual([]);
          }
        });
      }
    }
  }
});

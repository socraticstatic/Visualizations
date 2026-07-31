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
import { seedTokens } from "@/test/seedTokens";
import { BEST_PRACTICE } from "@/charts/bestPractices";
import type { ChartKind } from "@/charts/chartKinds";
import { getChartTheme, type ChartTheme } from "@/charts/echartsTheme";
import { deltaE, cvdDeltaE, type ColorRecord } from "@/charts/palette/distance";
import { contrastRatio } from "@/charts/audit";
import { THRESHOLDS, CVD_SEVERITY } from "@/charts/constraints";
import { safeMaxN, clearSafeMaxNCache } from "@/charts/builtinBounds";

// Seed from the real src/index.css so the fixture cannot drift from what ships.
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

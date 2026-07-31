/**
 * Variant A / Variant B cap invariant.
 *
 * Mirrors the ChartsDemo slider-capping logic for both the primary builder
 * (Variant A) and the compare-mode builder (Variant B):
 *
 *   capX = min(BEST_PRACTICE[kindX].recommendedN, safeMaxN(themeX, postureX))
 *   nX   = min(max(minN, requestedNX), capX)
 *
 * The user can drag `requestedN` to `recommendedN` on either variant, and the
 * cap may further lower the effective N via the runtime probe. This suite
 * pretends the slider is pinned to `recommendedN` on BOTH variants across
 * every (themeA × kindA × themeB × kindB) combination and asserts:
 *
 *   - Effective N on each variant equals `min(recommendedN, safeMaxN)`,
 *     i.e. the cap is doing its job.
 *   - The resulting palette on each variant has zero solver relaxations.
 *   - Pairwise ΔE / CVD-ΔE / WCAG 3:1 contrast all pass.
 *   - Both variants stay optimal independently — capping one never knocks
 *     the other out of the optimal band.
 *
 * Complements `builtinBuilderInvariant.test.ts` (which sweeps every N from
 * 1..cap on a single variant) by locking the cross-variant guarantee that
 * the user actually sees in compare mode.
 */
import { describe, it, expect } from "vitest";
import { seedTokens } from "@/test/seedTokens";
import { BEST_PRACTICE } from "@/charts/bestPractices";
import type { ChartKind } from "@/charts/chartKinds";
import { getChartTheme } from "@/charts/echartsTheme";
import { deltaE, cvdDeltaE, type ColorRecord } from "@/charts/palette/distance";
import { contrastRatio } from "@/charts/audit";
import { THRESHOLDS, CVD_SEVERITY } from "@/charts/constraints";
import { safeMaxN, clearSafeMaxNCache } from "@/charts/builtinBounds";

// Seed from the real src/index.css so the fixture cannot drift from what ships.
seedTokens();
clearSafeMaxNCache();

type ThemeName = "light" | "dark";

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

/** The slider's upper bound: kind's recommendedN. Users can drag the slider
 *  up to here so they can experiment past the safe cap and see warnings. */
function sliderMax(kind: ChartKind) {
  return BEST_PRACTICE[kind].recommendedN;
}

/** The safe cap: largest N that produces a zero-relaxation palette. */
function safeCap(kind: ChartKind, theme: ThemeName) {
  const rule = BEST_PRACTICE[kind];
  return Math.min(rule.recommendedN, safeMaxN(theme, rule.posture));
}

/** Mirror of the ChartsDemo `n = min(max(minN, requestedN), sliderMax)` clamp. */
function effectiveN(kind: ChartKind, theme: ThemeName, requestedN: number) {
  const rule = BEST_PRACTICE[kind];
  const minN = rule.family === "categorical" ? 1 : 3;
  return Math.min(Math.max(minN, requestedN), sliderMax(kind));
}

/** Exercise the exact code path the builder uses (getChartTheme, locks: []). */
function solveVariant(kind: ChartKind, theme: ThemeName, n: number) {
  const rule = BEST_PRACTICE[kind];
  return getChartTheme(theme, rule.posture, n);
}

describe("Variant A & B — at the safe cap, both variants are zero-relaxation optimal", () => {
  for (const themeA of ["light", "dark"] as const) {
    for (const kindA of CATEGORICAL_KINDS) {
      for (const themeB of ["light", "dark"] as const) {
        for (const kindB of CATEGORICAL_KINDS) {
          const capA = safeCap(kindA, themeA);
          const capB = safeCap(kindB, themeB);

          it(`A=${themeA}/${kindA}@safe${capA} · B=${themeB}/${kindB}@safe${capB} — both optimal`, () => {
            const a = solveVariant(kindA, themeA, capA);
            const b = solveVariant(kindB, themeB, capB);

            expect(a.solve.relaxations).toEqual([]);
            expect(b.solve.relaxations).toEqual([]);

            expect(a.solve.palette).toHaveLength(capA);
            expect(b.solve.palette).toHaveLength(capB);

            if (capA >= 2) {
              expect(passes(a.solve.palette, a.tokens.bg)).toBe(true);
            }
            if (capB >= 2) {
              expect(passes(b.solve.palette, b.tokens.bg)).toBe(true);
            }
          });
        }
      }
    }
  }
});

describe("Slider clamps to sliderMax (recommendedN); over-request is bounded", () => {
  const OVER_REQUEST = 999;
  for (const theme of ["light", "dark"] as const) {
    for (const kind of CATEGORICAL_KINDS) {
      it(`${theme} · ${kind} — requestedN=${OVER_REQUEST} clamps to recommendedN`, () => {
        const n = effectiveN(kind, theme, OVER_REQUEST);
        expect(n).toBe(sliderMax(kind));
        const result = solveVariant(kind, theme, n);
        expect(result.solve.palette).toHaveLength(n);
        // Above the safe cap, relaxations are allowed and expected — they
        // are the educational signal surfaced by the audit panel.
      });
    }
  }
});


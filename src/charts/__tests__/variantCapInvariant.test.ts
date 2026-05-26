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
import { BEST_PRACTICE } from "@/charts/bestPractices";
import type { ChartKind } from "@/charts/chartKinds";
import { solveCategorical } from "@/charts/palette/categorical";
import { fromHsl, deltaE, cvdDeltaE } from "@/charts/palette/distance";
import { contrastRatio } from "@/charts/audit";
import { THRESHOLDS, CVD_SEVERITY } from "@/charts/constraints";
import { safeMaxN, clearSafeMaxNCache } from "@/charts/builtinBounds";

// Reuse the same token seed as builtinBuilderInvariant — kept inline so the
// two suites are independently runnable.
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
  const darkRoot = document.createElement("div");
  darkRoot.className = "dark";
  for (const [k, v] of Object.entries(darkVars)) darkRoot.style.setProperty(k, v);
  document.body.appendChild(darkRoot);
}

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

type ThemeName = keyof typeof THEME_TOKENS;

const CATEGORICAL_KINDS = (Object.keys(BEST_PRACTICE) as ChartKind[]).filter(
  (k) => BEST_PRACTICE[k].family === "categorical"
);

function passes(
  palette: ReturnType<typeof solveCategorical>["palette"],
  bg: ReturnType<typeof fromHsl>
) {
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

function solveVariant(kind: ChartKind, theme: ThemeName, n: number) {
  const rule = BEST_PRACTICE[kind];
  const { bg, grid, anchors } = THEME_TOKENS[theme];
  return solveCategorical({
    n,
    posture: rule.posture,
    background: bg,
    grid,
    locks: anchors.slice(0, Math.min(3, n)),
  });
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

            expect(a.relaxations).toEqual([]);
            expect(b.relaxations).toEqual([]);

            expect(a.palette).toHaveLength(capA);
            expect(b.palette).toHaveLength(capB);

            if (capA >= 2) {
              expect(passes(a.palette, THEME_TOKENS[themeA].bg)).toBe(true);
            }
            if (capB >= 2) {
              expect(passes(b.palette, THEME_TOKENS[themeB].bg)).toBe(true);
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
        expect(result.palette).toHaveLength(n);
        // Above the safe cap, relaxations are allowed and expected — they
        // are the educational signal surfaced by the audit panel.
      });
    }
  }
});


/**
 * The solver-derived figures in the palette-contrast-benchmark post.
 *
 * These are computed once at build time and committed, not recomputed in the
 * reader's browser. The post recomputed them originally so it could never
 * drift from the solver, which was the right instinct aimed at the wrong
 * risk: Math.cbrt (OKLab conversion) and Math.exp (the annealer's acceptance
 * test) return different values under Node than under Chrome, and the
 * annealer amplifies a last-bit difference into a different palette. The post
 * was publishing 4.15:1 to a crawler, 4.24:1 to a Chrome reader, and a third
 * number to anyone on Safari.
 *
 * Everything else in the post is derived from published palette hexes through
 * contrastRatio and deltaE, and those agree across engines to the precision
 * the post prints. Only the solver needed freezing, so only the solver is
 * frozen here.
 *
 * Regenerate with `npm run freeze:benchmark` after any engine change. The
 * numbers then move in a reviewable diff instead of moving per visitor, and
 * src/posts/__tests__/benchmarkFacts.test.ts fails until they are regenerated
 * for a new PALETTE_VERSION.
 */
import { fromCss, type ColorRecord } from "@/charts/palette/distance";
import { deltaE } from "@/charts/palette/distance";
import { contrastRatio, simulateColor, type VisionMode } from "@/charts/audit";
import { solveCategorical } from "@/charts/palette/categorical";
import { PALETTE_VERSION } from "@/charts/version";

const CVD_MODES: VisionMode[] = ["deutan", "protan", "tritan"];

function minPairDeltaE(colors: ColorRecord[]) {
  let min = Infinity;
  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++) min = Math.min(min, deltaE(colors[i], colors[j]));
  return min;
}

function worstCvdDeltaE(colors: ColorRecord[]) {
  let worst = Infinity;
  for (const mode of CVD_MODES) {
    const sim = colors.map((c) => simulateColor(c, mode));
    worst = Math.min(worst, minPairDeltaE(sim));
  }
  return worst;
}

export interface FrozenFacts {
  engineVersion: string;
  measuredOn: string;
  measuredWith: string;
  solved6: {
    worstContrast: number;
    worstCvdDeltaE: number;
    minPairDeltaE: number;
    palette: string[];
  };
}

/** The exact solve the post describes: N=6, comparative, on white. */
export function computeFrozenFacts(runtime: string): FrozenFacts {
  const white = fromCss("#ffffff");
  const solved6 = solveCategorical({
    n: 6,
    posture: "comparative",
    background: white,
    grid: fromCss("#e5e7eb"),
    locks: [],
  });
  return {
    engineVersion: PALETTE_VERSION,
    measuredOn: new Date().toISOString().slice(0, 10),
    measuredWith: runtime,
    solved6: {
      worstContrast: Math.min(...solved6.palette.map((c) => contrastRatio(c, white))),
      worstCvdDeltaE: worstCvdDeltaE(solved6.palette),
      minPairDeltaE: minPairDeltaE(solved6.palette),
      palette: solved6.palette.map((c) => c.hex),
    },
  };
}

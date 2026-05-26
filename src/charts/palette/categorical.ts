/**
 * Categorical palette solver.
 *
 * Approach:
 *   1. Build a candidate cloud in OKLCH within posture-appropriate L/C bands.
 *   2. Seed with locked anchor colors.
 *   3. Farthest-point traversal under the worst-of-three CVD ΔE.
 *   4. Simulated annealing refinement maximizing min pairwise score.
 *
 * Deterministic via a seeded PRNG.
 */
import { formatHex } from "culori";
import {
  CVD_SEVERITY,
  PALETTE_SEED,
  POSTURE,
  RELAXATION_ORDER,
  THRESHOLDS,
  type Posture,
} from "../constraints";
import { cvdDeltaE, deltaE, deltaL, fromCss, type ColorRecord } from "./distance";
import { oklchToRgb, oklchOf, reduceToSrgb } from "./gamut";
import { converter, type Oklab } from "culori";

const toOklab = converter("oklab");

// Tiny seedable PRNG (mulberry32) — deterministic palettes across runs.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BandConfig {
  lMin: number;
  lMax: number;
  cMin: number;
  cMax: number;
}

function bandFor(posture: Posture, isDarkBg: boolean): BandConfig {
  const cfg = POSTURE[posture];
  // Lightness band must keep every candidate at ≥3:1 WCAG contrast against
  // the chart background (SC 1.4.11). For light bg (≈white) that caps OKLab
  // L at ~0.55; for dark bg (≈#0b1220) that floors it at ~0.55. Without
  // these limits the solver picked colors that failed the WCAG probe and
  // collapsed `safeMaxN` to 1.
  const baseL = isDarkBg ? { lMin: 0.55, lMax: 0.9 } : { lMin: 0.28, lMax: 0.58 };
  const chroma =
    cfg.chromaBias === "high"
      ? { cMin: 0.08, cMax: 0.24 }
      : cfg.chromaBias === "medium"
      ? { cMin: 0.08, cMax: 0.24 }
      : { cMin: 0.04, cMax: 0.12 };
  return { ...baseL, ...chroma };
}

function rgbToColorRecord(rgb: { r: number; g: number; b: number }): ColorRecord {
  const lab = toOklab({ mode: "rgb", ...rgb }) as Oklab;
  return {
    hex: formatHex({ mode: "rgb", ...rgb }) ?? "#000000",
    rgb,
    oklab: { l: lab.l ?? 0, a: lab.a ?? 0, b: lab.b ?? 0 },
  };
}

// Candidate clouds are deterministic functions of the band, and the band is
// itself a deterministic function of (posture, isDarkBg). Cache them so
// every solver call after the first reuses the same ~1728 ColorRecords —
// this also lets the CVD-projection WeakMap in distance.ts hit on every
// re-solve instead of re-allocating fresh records and re-simulating.
const CANDIDATE_CACHE = new Map<string, ColorRecord[]>();
function buildCandidates(band: BandConfig): ColorRecord[] {
  const key = `${band.lMin}|${band.lMax}|${band.cMin}|${band.cMax}`;
  const hit = CANDIDATE_CACHE.get(key);
  if (hit) return hit;
  const out: ColorRecord[] = [];
  // Hue every 5°, lightness 6 steps, chroma 4 steps → ~1728 candidates.
  // Density matters when N approaches the perceptual ceiling (~10–12 hues):
  // farthest-point traversal needs many neighbours to choose from.
  for (let h = 0; h < 360; h += 5) {
    for (let li = 0; li < 6; li++) {
      const l = band.lMin + (li / 5) * (band.lMax - band.lMin);
      for (let ci = 0; ci < 4; ci++) {
        const c = band.cMin + (ci / 3) * (band.cMax - band.cMin);
        const reduced = reduceToSrgb({ l, c, h });
        const rgb = oklchToRgb(reduced);
        out.push(rgbToColorRecord(rgb));
      }
    }
  }
  CANDIDATE_CACHE.set(key, out);
  return out;
}


interface ScoreOpts {
  background: ColorRecord;
  grid: ColorRecord;
  thresholds: typeof THRESHOLDS;
}

function pairScore(a: ColorRecord, b: ColorRecord): number {
  // Composite: optimise for the WORST channel — normal ΔE, CVD-worst ΔE,
  // and ΔL spread. Weighting CVD ≥ normal forces the solver to keep CVD
  // distance high even at large N (the rule that bites first as N grows).
  const n = deltaE(a, b);
  const c = cvdDeltaE(a, b, CVD_SEVERITY);
  const l = deltaL(a, b) * 100;
  return Math.min(n, c * 1.8, l * 4);
}

function minPairScore(palette: ColorRecord[]): number {
  let m = Infinity;
  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      const s = pairScore(palette[i], palette[j]);
      if (s < m) m = s;
    }
  }
  return m;
}

function backgroundPenalty(c: ColorRecord, opts: ScoreOpts): number {
  const dBg = deltaE(c, opts.background);
  const dGrid = deltaE(c, opts.grid);
  let p = 0;
  if (dBg < opts.thresholds.minDeltaEvsBackground) p += opts.thresholds.minDeltaEvsBackground - dBg;
  if (dGrid < opts.thresholds.minDeltaEvsGrid) p += (opts.thresholds.minDeltaEvsGrid - dGrid) * 0.5;
  return p;
}

export interface SolveInput {
  n: number;
  posture: Posture;
  background: ColorRecord;
  grid: ColorRecord;
  /** Locked anchor colors, in slot order. */
  locks: ColorRecord[];
}

export interface SolveResult {
  palette: ColorRecord[];
  minPairDeltaE: number;
  minCvdDeltaE: number;
  worstPair: [number, number];
  relaxations: string[];
}

export function solveCategorical(input: SolveInput): SolveResult {
  const isDarkBg = input.background.oklab.l < 0.5;
  const band = bandFor(input.posture, isDarkBg);
  const candidates = buildCandidates(band).filter(
    (c) => deltaE(c, input.background) >= THRESHOLDS.minDeltaEvsBackground * 0.7
  );
  const rand = mulberry32(PALETTE_SEED ^ input.n ^ (isDarkBg ? 1 : 0));

  // Seed with locks (truncated to N).
  const palette: ColorRecord[] = input.locks.slice(0, input.n).map((c) => c);

  // Farthest-point traversal for the rest.
  while (palette.length < input.n) {
    let best: ColorRecord | null = null;
    let bestScore = -Infinity;
    for (const cand of candidates) {
      let minD = Infinity;
      for (const p of palette) {
        const s = pairScore(cand, p);
        if (s < minD) minD = s;
      }
      if (palette.length === 0) minD = 100; // any candidate is fine
      const score = minD - backgroundPenalty(cand, { background: input.background, grid: input.grid, thresholds: THRESHOLDS });
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    if (!best) break;
    palette.push(best);
  }

  // Simulated annealing — only on non-locked slots. Longer schedule than
  // before so high-N palettes (10–12) get enough swap attempts to find
  // configurations that satisfy the CVD threshold simultaneously.
  const lockedCount = Math.min(input.locks.length, input.n);
  let temp = 1;
  let current = palette.slice();
  let currentScore = minPairScore(current);
  const steps = 1200 + input.n * 200;
  for (let step = 0; step < steps; step++) {
    const swappable = input.n - lockedCount;
    if (swappable <= 0) break;
    const i = lockedCount + Math.floor(rand() * swappable);
    if (i < lockedCount || i >= input.n) continue;
    const cand = candidates[Math.floor(rand() * candidates.length)];
    // Reject a candidate that duplicates a slot already in the palette —
    // gamut-boundary clamping can map two OKLCH points to the same sRGB hex,
    // which would produce ΔE=0 between those slots.
    if (current.some((p, idx) => idx !== i && p.hex === cand.hex)) continue;
    const trial = current.slice();
    trial[i] = cand;
    const trialScore =
      minPairScore(trial) -
      backgroundPenalty(cand, { background: input.background, grid: input.grid, thresholds: THRESHOLDS });
    const delta = trialScore - currentScore;
    if (delta > 0 || rand() < Math.exp(delta / (10 * temp))) {
      current = trial;
      currentScore = trialScore;
    }
    temp *= 0.995;
  }

  // Compute report.
  let minNormal = Infinity;
  let minCvd = Infinity;
  let worst: [number, number] = [0, 1];
  for (let i = 0; i < current.length; i++) {
    for (let j = i + 1; j < current.length; j++) {
      const n = deltaE(current[i], current[j]);
      const c = cvdDeltaE(current[i], current[j], CVD_SEVERITY);
      if (n < minNormal) minNormal = n;
      if (c < minCvd) {
        minCvd = c;
        worst = [i, j];
      }
    }
  }

  const relaxations: string[] = [];
  if (input.n >= 2) {
    if (minNormal < THRESHOLDS.minDeltaENormal) relaxations.push("minDeltaENormal");
    if (minCvd < THRESHOLDS.minDeltaECvd) relaxations.push("minDeltaECvd");
  }

  return {
    palette: current,
    minPairDeltaE: input.n >= 2 ? minNormal : Infinity,
    minCvdDeltaE: input.n >= 2 ? minCvd : Infinity,
    worstPair: worst,
    relaxations,
  };
}

// Re-export for tests.
export { RELAXATION_ORDER };

/**
 * Accessibility audit for a categorical palette.
 *
 * For every pair of slots, simulate normal + deutan + protan + tritan +
 * achromatopsia, compute OKLab ΔE, and report the minimum per mode against
 * the configured threshold. Also report each color's contrast against the
 * background (WCAG-style relative-luminance ratio for non-text marks; threshold
 * ≥ 3:1 per WCAG 2.2 SC 1.4.11 "Non-text contrast").
 */
import type { ColorRecord } from "./palette/distance";
import { deltaE } from "./palette/distance";
import { simulateRgb } from "./palette/cvd";
import { converter, formatHex, type Oklab } from "culori";
import { THRESHOLDS, CVD_SEVERITY } from "./constraints";

/** Runtime list of vision modes — the single source for the VisionMode type
 *  and for validating untrusted input (e.g. the `v` URL parameter). */
export const VISION_MODES = [
  "normal",
  "deutan",
  "protan",
  "tritan",
  "achromatopsia",
] as const;
export type VisionMode = (typeof VISION_MODES)[number];

function toGrayscale(c: ColorRecord): ColorRecord {
  // Rec. 709 luma requires linearized (scene-linear) inputs.
  // Linearize gamma-encoded sRGB values first (IEC 61966-2-1 threshold = 0.04045).
  const lin = (v: number) =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const linY = 0.2126 * lin(c.rgb.r) + 0.7152 * lin(c.rgb.g) + 0.0722 * lin(c.rgb.b);
  // Gamma-encode the linear luma back to sRGB for consistent downstream comparisons.
  const y = linY <= 0.0031308 ? 12.92 * linY : 1.055 * Math.pow(linY, 1 / 2.4) - 0.055;
  const grayRgb = { r: y, g: y, b: y };
  // Derive OKLab from the actual gray — do not borrow L from the original color.
  const lab = toOklab({ mode: "rgb", ...grayRgb }) as Oklab;
  return {
    hex: formatHex({ mode: "rgb", ...grayRgb }) ?? c.hex,
    rgb: grayRgb,
    oklab: { l: lab.l ?? 0, a: 0, b: 0 },
  };
}

const toOklab = converter("oklab");

export function simulateColor(c: ColorRecord, mode: VisionMode): ColorRecord {
  return simulate(c, mode);
}

function simulate(c: ColorRecord, mode: VisionMode): ColorRecord {
  if (mode === "normal") return c;
  if (mode === "achromatopsia") return toGrayscale(c);
  const rgb = simulateRgb(c.rgb, mode, CVD_SEVERITY);
  const lab = toOklab({ mode: "rgb", ...rgb }) as Oklab;
  return {
    hex: formatHex({ mode: "rgb", ...rgb }) ?? c.hex,
    rgb,
    oklab: { l: lab.l ?? 0, a: lab.a ?? 0, b: lab.b ?? 0 },
  };
}

function relativeLuminance(c: { r: number; g: number; b: number }) {
  // Use IEC 61966-2-1 threshold (0.04045) — consistent with toGrayscale and cvd.ts.
  const lin = (v: number) =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/**
 * WCAG relative-luminance contrast ratio.
 *
 * Takes only the `rgb` channel because that is all the formula reads. Callers
 * such as the swatch label picker hold `{hex, rgb}` pairs that were never run
 * through OKLab, and requiring a full ColorRecord forced a cast that hid the
 * mismatch rather than describing it.
 */
export function contrastRatio(
  a: Pick<ColorRecord, "rgb">,
  b: Pick<ColorRecord, "rgb">
): number {
  const la = relativeLuminance(a.rgb);
  const lb = relativeLuminance(b.rgb);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface VisionResult {
  mode: VisionMode;
  minDeltaE: number;
  pass: boolean;
  threshold: number;
}

/** Ramp family for the grayscale-survival check. */
export type RampKind = "sequential" | "diverging";

function isStrictlyMonotone(vals: number[]): boolean {
  if (vals.length < 2) return true;
  const increasing = vals[1] > vals[0];
  for (let i = 1; i < vals.length; i++) {
    if (increasing ? vals[i] <= vals[i - 1] : vals[i] >= vals[i - 1]) return false;
  }
  return true;
}

/**
 * Grayscale-survival check for a RAMP (pairwise ΔE is skipped for ramps, but
 * grayscale IS meaningful). A monotonic-L ramp is not automatically
 * grayscale-safe — Rec.709 luma ordering can disagree with OKLab L across hue,
 * so check the achromatopsia projection directly:
 *   - sequential: strictly monotone in gray, adjacent stops separated ≥ floor.
 *   - diverging: monotone on EACH arm around the structural midpoint. Cross-arm
 *     grayscale collapse is inherent to diverging colormaps (both ends read
 *     alike in gray) and is NOT flagged; a non-monotone ARM is a real defect.
 */
function rampGrayscaleResult(
  palette: ColorRecord[],
  kind: RampKind,
  threshold: number
): VisionResult {
  const grays = palette.map((c) => simulate(c, "achromatopsia"));
  const L = grays.map((g) => g.oklab.l);
  let minAdj = Infinity;
  for (let i = 1; i < grays.length; i++) {
    minAdj = Math.min(minAdj, deltaE(grays[i - 1], grays[i]));
  }
  let pass: boolean;
  if (kind === "sequential") {
    pass = isStrictlyMonotone(L) && minAdj >= threshold;
  } else {
    const mid = Math.floor(L.length / 2);
    pass = isStrictlyMonotone(L.slice(0, mid + 1)) && isStrictlyMonotone(L.slice(mid));
  }
  return { mode: "achromatopsia", minDeltaE: minAdj, pass, threshold };
}

export interface AuditReport {
  perVision: VisionResult[];
  /** Worst contrast ratio of any slot vs. the chart background. */
  worstContrastVsBg: number;
  bgPass: boolean; // ≥ 3:1
  overall: "pass" | "warn" | "fail";
}

/**
 * @param ramp - `false` for a categorical palette (full pairwise audit). For a
 *   ramp, pass its kind (`"sequential"` | `"diverging"`) — pairwise ΔE is
 *   skipped (gradient stops are meant to be close) but the achromatopsia mode
 *   runs a ramp-appropriate grayscale-survival check (see rampGrayscaleResult).
 *   `true` is the legacy "skip everything for a ramp" form, kept for callers
 *   that don't know the kind: it force-passes every mode as before.
 */
export function auditPalette(
  palette: ColorRecord[],
  background: ColorRecord,
  ramp: boolean | RampKind = false
): AuditReport {
  const isRamp = ramp !== false;
  const rampKind: RampKind | null = typeof ramp === "string" ? ramp : null;

  const perVision: VisionResult[] = VISION_MODES.map((mode) => {
    const threshold =
      mode === "normal"
        ? THRESHOLDS.minDeltaENormal
        : mode === "achromatopsia"
        ? THRESHOLDS.minDeltaL * 100 // ΔL only
        : THRESHOLDS.minDeltaECvd;

    // Ramp families: pairwise ΔE is not meaningful — gradient stops are meant
    // to be perceptually close. Grayscale survival IS meaningful, though, so
    // when the kind is known, run a ramp-appropriate check for that mode.
    if (isRamp) {
      if (mode === "achromatopsia" && rampKind && palette.length >= 2) {
        return rampGrayscaleResult(palette, rampKind, threshold);
      }
      return { mode, minDeltaE: Infinity, pass: true, threshold };
    }

    let min = Infinity;
    if (palette.length >= 2) {
      const sim = palette.map((c) => simulate(c, mode));
      for (let i = 0; i < sim.length; i++) {
        for (let j = i + 1; j < sim.length; j++) {
          const d = deltaE(sim[i], sim[j]);
          if (d < min) min = d;
        }
      }
    }
    return {
      mode,
      minDeltaE: palette.length >= 2 ? min : Infinity,
      pass: palette.length < 2 ? true : min >= threshold,
      threshold,
    };
  });

  let worstContrast = Infinity;
  for (const c of palette) {
    const r = contrastRatio(c, background);
    if (r < worstContrast) worstContrast = r;
  }
  const bgPass = worstContrast >= 3; // WCAG 2.2 SC 1.4.11

  const fails = perVision.filter((v) => !v.pass).length;
  // An empty palette has nothing to audit — every check above passes
  // vacuously, and reporting "pass" for zero colors would be a lie.
  const overall: AuditReport["overall"] =
    palette.length === 0
      ? "fail"
      : fails === 0 && bgPass
      ? "pass"
      : fails <= 1 && bgPass
      ? "warn"
      : "fail";

  return { perVision, worstContrastVsBg: worstContrast, bgPass, overall };
}

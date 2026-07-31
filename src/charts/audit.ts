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

export type VisionMode = "normal" | "deutan" | "protan" | "tritan" | "achromatopsia";

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

export interface AuditReport {
  perVision: VisionResult[];
  /** Worst contrast ratio of any slot vs. the chart background. */
  worstContrastVsBg: number;
  bgPass: boolean; // ≥ 3:1
  overall: "pass" | "warn" | "fail";
}

/**
 * @param skipPairwiseDeltaE - Pass true for sequential/diverging ramps.
 *   Gradient stops are intentionally close; pairwise ΔE separation is not a
 *   meaningful metric for ramps and would always flag them as failing. When
 *   true, all vision-mode ΔE entries report Infinity (pass); overall is
 *   determined solely by WCAG background contrast.
 */
export function auditPalette(
  palette: ColorRecord[],
  background: ColorRecord,
  skipPairwiseDeltaE = false
): AuditReport {
  const modes: VisionMode[] = ["normal", "deutan", "protan", "tritan", "achromatopsia"];
  const perVision: VisionResult[] = modes.map((mode) => {
    const threshold =
      mode === "normal"
        ? THRESHOLDS.minDeltaENormal
        : mode === "achromatopsia"
        ? THRESHOLDS.minDeltaL * 100 // ΔL only
        : THRESHOLDS.minDeltaECvd;

    // Ramp families: pairwise separation is not meaningful — gradient stops
    // are designed to be perceptually close. Report n/a (Infinity = pass).
    if (skipPairwiseDeltaE) {
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
  const overall: AuditReport["overall"] =
    fails === 0 && bgPass ? "pass" : fails <= 1 && bgPass ? "warn" : "fail";

  return { perVision, worstContrastVsBg: worstContrast, bgPass, overall };
}

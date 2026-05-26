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
  // Rec. 709 luma → replicate to RGB then re-derive OKLab via a cheap shortcut
  // (we only need ΔE-comparable values).
  const y = 0.2126 * c.rgb.r + 0.7152 * c.rgb.g + 0.0722 * c.rgb.b;
  return {
    hex: c.hex,
    rgb: { r: y, g: y, b: y },
    oklab: { l: c.oklab.l, a: 0, b: 0 },
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
  const lin = (v: number) => {
    const x = v; // already 0..1
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

export function contrastRatio(a: ColorRecord, b: ColorRecord): number {
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

export function auditPalette(palette: ColorRecord[], background: ColorRecord): AuditReport {
  const modes: VisionMode[] = ["normal", "deutan", "protan", "tritan", "achromatopsia"];
  const perVision: VisionResult[] = modes.map((mode) => {
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
    const threshold =
      mode === "normal"
        ? THRESHOLDS.minDeltaENormal
        : mode === "achromatopsia"
        ? THRESHOLDS.minDeltaL * 100 // ΔL only
        : THRESHOLDS.minDeltaECvd;
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

/**
 * Color-vision deficiency simulation using the Machado 2009 matrices.
 * Severity is 0..1; values between table entries are linearly interpolated.
 *
 * Source: Machado, Oliveira & Fernandes 2009.
 */

type Matrix = [number, number, number, number, number, number, number, number, number];

// Severity 1.0 matrices (sRGB linear). Subset — we only need full severity here.
const PROTAN_1: Matrix = [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998];
const DEUTAN_1: Matrix = [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881];
const TRITAN_1: Matrix = [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900];
const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function lerpMatrix(a: Matrix, b: Matrix, t: number): Matrix {
  return a.map((v, i) => v + (b[i] - v) * t) as Matrix;
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export type CvdType = "normal" | "deutan" | "protan" | "tritan";

export function simulateRgb(
  rgb: { r: number; g: number; b: number },
  type: CvdType,
  severity = 1
): { r: number; g: number; b: number } {
  if (type === "normal" || severity <= 0) return rgb;
  const target = type === "deutan" ? DEUTAN_1 : type === "protan" ? PROTAN_1 : TRITAN_1;
  const m = lerpMatrix(IDENTITY, target, severity);
  // Linearize, apply matrix, de-linearize.
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const nr = m[0] * r + m[1] * g + m[2] * b;
  const ng = m[3] * r + m[4] * g + m[5] * b;
  const nb = m[6] * r + m[7] * g + m[8] * b;
  return {
    r: Math.max(0, Math.min(1, linearToSrgb(nr))),
    g: Math.max(0, Math.min(1, linearToSrgb(ng))),
    b: Math.max(0, Math.min(1, linearToSrgb(nb))),
  };
}

export const CVD_TYPES: CvdType[] = ["normal", "deutan", "protan", "tritan"];

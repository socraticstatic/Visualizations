import { fromCss, type ColorRecord } from "@engine/palette/distance";

/** Figma's paint colour: sRGB channels in 0..1, the same space as ColorRecord.rgb. */
export interface FigmaRgb {
  r: number;
  g: number;
  b: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Figma paint to engine ColorRecord. Percentage syntax rather than 0-255
 * integers so the 0..1 channels survive without rounding.
 */
export function fromFigmaRgb(c: FigmaRgb): ColorRecord {
  return fromCss(`rgb(${clamp01(c.r) * 100}% ${clamp01(c.g) * 100}% ${clamp01(c.b) * 100}%)`);
}

export function toFigmaRgb(c: ColorRecord): FigmaRgb {
  return { r: clamp01(c.rgb.r), g: clamp01(c.rgb.g), b: clamp01(c.rgb.b) };
}

/**
 * Alpha-composite `fg` over `bg` in sRGB, because that is where Figma
 * composites. Doing it in OKLab would report a contrast nobody sees.
 */
export function compositeOver(fg: ColorRecord, alpha: number, bg: ColorRecord): ColorRecord {
  const a = clamp01(alpha);
  const mix = (f: number, b: number) => f * a + b * (1 - a);
  return fromFigmaRgb({
    r: mix(fg.rgb.r, bg.rgb.r),
    g: mix(fg.rgb.g, bg.rgb.g),
    b: mix(fg.rgb.b, bg.rgb.b),
  });
}

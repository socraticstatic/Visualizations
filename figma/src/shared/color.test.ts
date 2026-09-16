import { describe, it, expect } from "vitest";
import { fromCss } from "@engine/palette/distance";
import { fromFigmaRgb, toFigmaRgb, compositeOver } from "./color";

describe("fromFigmaRgb / toFigmaRgb", () => {
  it("round-trips 0..1 channels within 1e-6", () => {
    for (const s of [
      { r: 0, g: 0, b: 0 },
      { r: 1, g: 1, b: 1 },
      { r: 0.2, g: 0.4, b: 0.6 },
      { r: 0.13333333, g: 0.77254901, b: 0.05098039 },
    ]) {
      const back = toFigmaRgb(fromFigmaRgb(s));
      expect(Math.abs(back.r - s.r)).toBeLessThan(1e-6);
      expect(Math.abs(back.g - s.g)).toBeLessThan(1e-6);
      expect(Math.abs(back.b - s.b)).toBeLessThan(1e-6);
    }
  });

  it("produces a usable hex and oklab", () => {
    const c = fromFigmaRgb({ r: 1, g: 0, b: 0 });
    expect(c.hex).toBe("#ff0000");
    expect(c.oklab.l).toBeGreaterThan(0);
  });

  it("clamps out-of-gamut input rather than emitting NaN", () => {
    const c = fromFigmaRgb({ r: 1.4, g: -0.2, b: 0.5 });
    expect(Number.isFinite(c.oklab.l)).toBe(true);
    expect(c.rgb.r).toBeLessThanOrEqual(1);
    expect(c.rgb.g).toBeGreaterThanOrEqual(0);
  });
});

describe("compositeOver", () => {
  const fg = fromCss("#ff0000");
  const bg = fromCss("#ffffff");

  it("returns the foreground at alpha 1 and the background at alpha 0", () => {
    expect(compositeOver(fg, 1, bg).hex).toBe(fg.hex);
    expect(compositeOver(fg, 0, bg).hex).toBe(bg.hex);
  });

  it("blends linearly in sRGB at alpha 0.5", () => {
    const out = compositeOver(fromCss("#000000"), 0.5, fromCss("#ffffff"));
    // 0.5 is not representable on the 8-bit sRGB grid the result is actually
    // drawn at; the nearest value is 128/255. ColorRecord snaps to that grid
    // at construction (palette/deterministic.ts) so a record describes the
    // colour it names rather than one a fraction of a step away.
    expect(Math.abs(out.rgb.r - 128 / 255)).toBeLessThan(1e-6);
  });

  it("clamps alpha outside 0..1", () => {
    expect(compositeOver(fg, 2, bg).hex).toBe(fg.hex);
    expect(compositeOver(fg, -1, bg).hex).toBe(bg.hex);
  });
});

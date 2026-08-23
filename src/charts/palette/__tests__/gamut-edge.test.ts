import { describe, it, expect } from "vitest";
import { fromCss } from "../distance";
import { sequentialRamp, divergingRamp } from "../ramps";
import { reduceToSrgb, oklchOf } from "../gamut";

// Regression: a valid sRGB color whose OKLCH roundtrip lands a hair outside
// [0,1] (pure blue #0000ff -> r = -9.3e-15) was judged out of gamut and its
// chroma reduced, rewriting #0000ff to #0031e5 (ΔE 4.76). A displayable token
// must be preserved exactly. See gamut.ts inGamutWithinEps.
describe("gamut edge color preservation", () => {
  it("keeps pure blue #0000ff unchanged through chroma reduction", () => {
    const o = oklchOf({ r: 0, g: 0, b: 1 });
    const reduced = reduceToSrgb(o);
    expect(reduced.c).toBeCloseTo(o.c, 10);
  });

  it("preserves a gamut-edge midpoint token in a diverging ramp", () => {
    const neg = fromCss("#c52020");
    const mid = fromCss("#0000ff");
    const pos = fromCss("#20c520");
    const ramp = divergingRamp(neg, mid, pos, 9);
    // Odd step count lands one stop exactly on the midpoint.
    expect(ramp[4].hex).toBe("#0000ff");
  });

  it("preserves a gamut-edge endpoint in a sequential ramp", () => {
    const start = fromCss("#0000ff");
    const end = fromCss("#ffffff");
    const ramp = sequentialRamp(start, end, 7);
    expect(ramp[0].hex).toBe("#0000ff");
  });

  it("still reduces a genuinely out-of-gamut color", () => {
    // Impossible sRGB: high chroma at mid lightness on the blue axis.
    const out = reduceToSrgb({ l: 0.5, c: 0.4, h: 264 });
    expect(out.c).toBeLessThan(0.4);
  });
});

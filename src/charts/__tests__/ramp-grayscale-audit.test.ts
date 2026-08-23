import { describe, it, expect } from "vitest";
import { seedTokens } from "@/test/seedTokens";
import { getChartTheme, type Theme } from "@/charts/echartsTheme";
import { sequentialRamp, divergingRamp } from "@/charts/palette/ramps";
import { auditPalette } from "@/charts/audit";
import { fromCss } from "@/charts/palette/distance";

// Adversary v1 finding B2: a ramp monotonic in OKLab L is NOT automatically
// grayscale-safe, and the audit force-passed ALL ramps. auditPalette now runs a
// grayscale-survival check when the ramp kind is known.
seedTokens();

const achroPass = (r: ReturnType<typeof auditPalette>) =>
  r.perVision.find((v) => v.mode === "achromatopsia")!.pass;

describe("ramp grayscale audit", () => {
  const themes: Theme[] = ["light", "dark"];

  for (const theme of themes) {
    it(`${theme}: shipped sequential ramp survives grayscale at every step count`, () => {
      const t = getChartTheme(theme, "comparative", 7);
      for (const steps of [3, 5, 7, 9]) {
        const ramp = sequentialRamp(t.tokens.seqLow, t.tokens.seqHigh, steps);
        expect(achroPass(auditPalette(ramp, t.tokens.bg, "sequential"))).toBe(true);
      }
    });

    it(`${theme}: shipped diverging ramp is per-arm grayscale-monotone`, () => {
      const t = getChartTheme(theme, "comparative", 7);
      for (const steps of [3, 5, 7, 9]) {
        const ramp = divergingRamp(t.tokens.divNeg, t.tokens.divMid, t.tokens.divPos, steps);
        expect(achroPass(auditPalette(ramp, t.tokens.bg, "diverging"))).toBe(true);
      }
    });
  }

  it("flags a grayscale-inverted user sequential ramp (the B2 repro)", () => {
    const ramp = sequentialRamp(fromCss("#2aa198"), fromCss("#b58900"), 7);
    expect(achroPass(auditPalette(ramp, fromCss("#ffffff"), "sequential"))).toBe(false);
  });

  it("the legacy boolean form still force-passes a ramp (back-compat)", () => {
    const ramp = sequentialRamp(fromCss("#2aa198"), fromCss("#b58900"), 7);
    expect(achroPass(auditPalette(ramp, fromCss("#ffffff"), true))).toBe(true);
  });

  it("categorical (no ramp arg) is unaffected — still runs the pairwise gate", () => {
    const t = getChartTheme("light", "comparative", 6);
    // a real categorical palette from the engine passes its own audit
    expect(auditPalette(t.solve.palette, t.tokens.bg).overall).toBe("pass");
  });
});

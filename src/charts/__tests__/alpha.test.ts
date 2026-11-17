/**
 * Transparency. fromCss used to drop alpha, so a translucent color was
 * measured as if it were solid: `transparent` on white was black at 21:1 and
 * passed. A translucent mark is seen blended with the background, so that
 * blend is what the audit has to measure.
 */
import { describe, expect, it } from "vitest";
import { auditPalette, compositeOver, contrastRatio, fromCss } from "@/charts";

const white = fromCss("#ffffff");

describe("alpha", () => {
  it("is recorded only on a translucent color", () => {
    expect(fromCss("#2456a4").alpha).toBeUndefined();
    expect(fromCss("rgb(0 0 0 / 1)").alpha).toBeUndefined();
    expect(fromCss("rgba(0, 0, 0, 0.5)").alpha).toBeCloseTo(0.5, 6);
    expect(fromCss("#00000080").alpha).toBeCloseTo(128 / 255, 6);
    expect(fromCss("transparent").alpha).toBe(0);
  });

  it("composites over the background in sRGB", () => {
    expect(compositeOver(fromCss("rgba(0, 0, 0, 0.5)"), white).hex).toBe("#808080");
    expect(compositeOver(fromCss("transparent"), white).hex).toBe("#ffffff");
    expect(compositeOver(fromCss("rgba(255, 255, 255, 0.25)"), fromCss("#000000")).hex).toBe("#404040");
  });

  it("returns an opaque color unchanged, and a composited color is opaque", () => {
    const opaque = fromCss("#2456a4");
    expect(compositeOver(opaque, white)).toBe(opaque);
    expect(compositeOver(fromCss("rgba(0, 0, 0, 0.5)"), white).alpha).toBeUndefined();
  });

  it("a fully transparent mark fails the contrast floor instead of passing as black", () => {
    const report = auditPalette([fromCss("transparent")], white);
    expect(report.worstContrastVsBg).toBeCloseTo(1, 6);
    expect(report.bgPass).toBe(false);
    expect(report.overall).toBe("fail");
  });

  it("10% black on white is a pale gray well under 3:1", () => {
    const report = auditPalette([fromCss("rgba(0, 0, 0, 0.1)")], white);
    expect(report.worstContrastVsBg).toBeLessThan(1.5);
    expect(report.bgPass).toBe(false);
  });

  it("two opacities of one hue are compared as rendered", () => {
    const solid = fromCss("rgb(36 86 164)");
    const faint = fromCss("rgb(36 86 164 / 0.3)");
    const normal = auditPalette([solid, faint], white).perVision.find((v) => v.mode === "normal")!;
    expect(normal.minDeltaE).toBeGreaterThan(10);
  });

  it("an opaque palette audits exactly as before", () => {
    const palette = ["#2456a4", "#b03a2e", "#3b7d3a"].map(fromCss);
    const report = auditPalette(palette, white);
    const worst = Math.min(...palette.map((c) => contrastRatio(c, white)));
    expect(report.worstContrastVsBg).toBe(worst);
  });

  it("refuses a translucent background", () => {
    expect(() => auditPalette([fromCss("#000000")], fromCss("rgba(255, 255, 255, 0.5)"))).toThrow(/not opaque/);
  });
});

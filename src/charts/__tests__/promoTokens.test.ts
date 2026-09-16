import { describe, it, expect } from "vitest";
import { contrastRatio } from "@/charts/audit";
import { PROMO } from "@/components/charts/promoTokens";

describe("plugin promo palette", () => {
  it.each(["ground", "raised"] as const)("body and heading clear 4.5:1 on %s", (surface) => {
    for (const key of ["heading", "body"] as const) {
      expect(contrastRatio(PROMO[key], PROMO[surface])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("quiet text still clears 4.5:1, because small print is still text", () => {
    expect(contrastRatio(PROMO.quiet, PROMO.ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PROMO.quiet, PROMO.raised)).toBeGreaterThanOrEqual(4.5);
  });

  it("the call to action label clears 4.5:1 on its own fill", () => {
    expect(contrastRatio(PROMO.onAccent, PROMO.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("the accent is visible against the ground it sits on", () => {
    expect(contrastRatio(PROMO.accent, PROMO.ground)).toBeGreaterThanOrEqual(3);
  });

  it("the hairline is a divider, not information, so it is exempt from 3:1", () => {
    expect(contrastRatio(PROMO.hairline, PROMO.ground)).toBeGreaterThan(1);
  });
});

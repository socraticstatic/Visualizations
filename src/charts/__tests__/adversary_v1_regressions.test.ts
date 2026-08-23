import { describe, it, expect } from "vitest";
import { seedTokens } from "@/test/seedTokens";
import { fromCss } from "../palette/distance";
import { divergingRamp } from "../palette/ramps";
import { safeMaxN, clearSafeMaxNCache } from "../builtinBounds";
import { getChartTheme } from "../echartsTheme";
import { auditPalette } from "../audit";
import type { Theme, Posture } from "../echartsTheme";

seedTokens();

// Regressions for the v1 machine-adversary findings. See docs/ADVERSARY-V1-FINDINGS.md.

describe("divergingRamp steps=1 lands on the midpoint", () => {
  it("returns the neutral midpoint, not the negative extreme", () => {
    const neg = fromCss("#c52020");
    const mid = fromCss("#848f9a");
    const pos = fromCss("#2060c5");
    const ramp = divergingRamp(neg, mid, pos, 1);
    expect(ramp).toHaveLength(1);
    expect(ramp[0].hex).toBe(mid.hex);
  });
});

describe("safeMaxN never certifies a palette the audit fails", () => {
  const themes: Theme[] = ["light", "dark"];
  const postures: Posture[] = ["kpi", "comparative", "exploratory"];
  for (const theme of themes) {
    for (const posture of postures) {
      it(`${theme}/${posture}: the certified palette passes the full audit`, () => {
        clearSafeMaxNCache();
        const n = safeMaxN(theme, posture);
        const t = getChartTheme(theme, posture, n);
        // The certification claim is "full constraint satisfaction" — which must
        // include the achromatopsia gate the audit enforces.
        expect(auditPalette(t.solve.palette, t.tokens.bg).overall).toBe("pass");
      });
    }
  }
});

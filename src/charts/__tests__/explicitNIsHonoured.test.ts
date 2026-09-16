/**
 * A number the user chose has to survive.
 *
 * builtinBounds.ts says the slider "does NOT clamp its max to this value", and
 * the slider's own comment says values above the safe cap surface warnings "so
 * people can see and learn from their mistakes instead of being blocked".
 * Neither was true: clampBuiltInN applied the safe cap to every value,
 * including one dragged on the slider or carried in a shared link. Since
 * safeMaxN is 6 for every theme and posture, the slider ran to 12, the label
 * read "max 12", and the committed value was always 6 - so the overflow flag,
 * the aboveSafe warning and the whole 6-to-12 range were unreachable, and a
 * shared link could say n=12 while rendering 6.
 *
 * Mirrors the ChartsDemo logic, in the manner of variantCapInvariant.test.ts,
 * and guards the real call site by source so the mirror cannot drift from it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { seedTokens } from "@/test/seedTokens";
import { BEST_PRACTICE } from "@/charts/bestPractices";
import type { ChartKind } from "@/charts/chartKinds";
import { safeMaxN, clearSafeMaxNCache } from "@/charts/builtinBounds";
import type { Theme } from "@/charts/echartsTheme";

seedTokens();
clearSafeMaxNCache();

/** Mirror of ChartsDemo's clampBuiltInN. */
function clamp(k: ChartKind, t: Theme, requested: number, mode: "explicit" | "snap") {
  const r = BEST_PRACTICE[k];
  const min = r.family === "categorical" ? 1 : 3;
  const max =
    r.family === "categorical" && mode === "snap"
      ? Math.min(r.recommendedN, safeMaxN(t, r.posture))
      : r.recommendedN;
  return Math.min(Math.max(min, requested), max);
}

const CATEGORICAL = (Object.keys(BEST_PRACTICE) as ChartKind[]).filter(
  (k) => BEST_PRACTICE[k].family === "categorical"
);
const THEMES: Theme[] = ["light", "dark"];

describe("an explicitly chosen N", () => {
  it("reaches the slider's own maximum, which is what the label promises", () => {
    for (const k of CATEGORICAL) {
      for (const t of THEMES) {
        const sliderMax = BEST_PRACTICE[k].recommendedN;
        expect(clamp(k, t, sliderMax, "explicit"), `${k}/${t}`).toBe(sliderMax);
      }
    }
  });

  it("is only capped when nobody asked for it", () => {
    for (const k of CATEGORICAL) {
      for (const t of THEMES) {
        const r = BEST_PRACTICE[k];
        const safe = Math.min(r.recommendedN, safeMaxN(t, r.posture));
        expect(clamp(k, t, r.recommendedN, "snap"), `${k}/${t}`).toBe(safe);
      }
    }
  });

  it("covers a range the safe cap alone would make unreachable", () => {
    // If this ever stops holding the distinction is moot, and the warning
    // machinery for the zone above the cap is dead code again.
    const reachable = CATEGORICAL.some((k) =>
      THEMES.some((t) => {
        const r = BEST_PRACTICE[k];
        return r.recommendedN > Math.min(r.recommendedN, safeMaxN(t, r.posture));
      })
    );
    expect(reachable).toBe(true);
  });
});

describe("the real call site", () => {
  const SRC = readFileSync(join(__dirname, "..", "..", "pages", "ChartsDemo.tsx"), "utf8");

  it("asks for explicit mode whenever a caller supplied an N", () => {
    expect(SRC).toContain('next.n !== undefined ? "explicit" : "snap"');
  });

  it("still applies the safe cap to snaps", () => {
    expect(SRC).toContain('mode === "snap"');
    expect(SRC).toContain("safeMaxN(t, r.posture)");
  });
});

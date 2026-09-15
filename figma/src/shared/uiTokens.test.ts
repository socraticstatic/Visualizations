/**
 * The plugin makes accessibility claims, so its own chrome is audited with the
 * same engine. The first build shipped black text on Figma's dark panel because
 * no colour was set at all; this test exists so that cannot happen twice.
 *
 * These are FALLBACKS. Figma's own --figma-color-* variables win at runtime.
 * They apply when themeColors is unavailable, so they must stand alone.
 */
import { describe, it, expect } from "vitest";
import { contrastRatio } from "@engine/audit";
import { UI_FALLBACK } from "./uiTokens";

const THEMES = ["light", "dark"] as const;

describe("UI fallback palette", () => {
  it("defines the same keys in both themes", () => {
    expect(Object.keys(UI_FALLBACK.light).sort()).toEqual(Object.keys(UI_FALLBACK.dark).sort());
  });

  it.each(THEMES)("%s: body text clears 4.5:1 on both surfaces", (theme) => {
    const t = UI_FALLBACK[theme];
    expect(contrastRatio(t.text, t.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.text, t.bgSecondary)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("%s: secondary text clears 4.5:1, because 11px is small text", (theme) => {
    const t = UI_FALLBACK[theme];
    expect(contrastRatio(t.textSecondary, t.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.textSecondary, t.bgSecondary)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("%s: verdict colours clear 4.5:1 on the panel", (theme) => {
    const t = UI_FALLBACK[theme];
    for (const key of ["textDanger", "textSuccess", "textWarning"] as const) {
      expect(contrastRatio(t[key], t.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(THEMES)("%s: button label clears 4.5:1 on its own brand fill", (theme) => {
    const t = UI_FALLBACK[theme];
    expect(contrastRatio(t.textOnBrand, t.brand)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("%s: control borders clear the 3:1 non-text floor", (theme) => {
    const t = UI_FALLBACK[theme];
    expect(contrastRatio(t.borderStrong, t.bg)).toBeGreaterThanOrEqual(3);
  });

  it("orients light lighter than dark, so the two are not swapped", () => {
    expect(UI_FALLBACK.light.bg.oklab.l).toBeGreaterThan(UI_FALLBACK.dark.bg.oklab.l);
    expect(UI_FALLBACK.light.text.oklab.l).toBeLessThan(UI_FALLBACK.dark.text.oklab.l);
  });
});

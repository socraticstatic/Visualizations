/**
 * Regression tests for the headline feature: user-edited anchor colors are
 * REAL — they are locked verbatim into the solved palette, and the audit
 * honestly reports what they break.
 *
 * Also pins the inverse guarantee: with no edited anchors, getChartTheme
 * solves with `locks: []`, byte-identical to the built-in path that the
 * SystemAudit sweep and builtinBuilderInvariant.test.ts validate.
 */
import { describe, it, expect, afterEach } from "vitest";
import { seedTokens } from "@/test/seedTokens";
import { getChartTheme, clearChartThemeCache } from "@/charts/echartsTheme";
import {
  clearEditedAnchors,
  getEditedAnchorIndexes,
  markAnchorEdited,
} from "@/charts/manualOverrides";
import { clearSafeMaxNCache } from "@/charts/builtinBounds";
import { auditPalette } from "@/charts/audit";
import { THRESHOLDS } from "@/charts/constraints";

seedTokens();
clearSafeMaxNCache();

const root = document.documentElement;
const ORIG_ANCHOR_1 = root.style.getPropertyValue("--chart-cat-anchor-1");
const ORIG_ANCHOR_2 = root.style.getPropertyValue("--chart-cat-anchor-2");

afterEach(() => {
  clearEditedAnchors();
  clearChartThemeCache();
  root.style.setProperty("--chart-cat-anchor-1", ORIG_ANCHOR_1);
  root.style.setProperty("--chart-cat-anchor-2", ORIG_ANCHOR_2);
});

// Two nearly identical grays whose OKLab ΔE (~0.68 × 100) sits below the
// minDeltaENormal floor of 1 — a guaranteed collision the audit must flag.
// (The obvious pair #777777 / #7a7a7a lands at ΔE 1.03, marginally ABOVE the
// floor, so it would not exercise the failure path.)
const GRAY_A = "0 0% 46.6667%"; // #777777
const GRAY_B = "0 0% 47.451%"; // #797979

describe("user-edited anchors become hard locks", () => {
  it("locks edited anchors verbatim into the palette and the audit reports the collision", () => {
    root.style.setProperty("--chart-cat-anchor-1", GRAY_A);
    root.style.setProperty("--chart-cat-anchor-2", GRAY_B);
    markAnchorEdited("light", 0);
    markAnchorEdited("light", 1);
    clearChartThemeCache();

    const t = getChartTheme("light", "comparative", 2);

    // The user's exact colors ARE the palette — not seeds, not suggestions.
    expect(t.solve.palette.map((c) => c.hex)).toEqual(["#777777", "#797979"]);

    // Per-anchor honesty surface: each edited anchor knows its slot.
    expect(t.anchorLocks).toEqual([
      { anchorIndex: 0, hex: "#777777", slot: 0 },
      { anchorIndex: 1, hex: "#797979", slot: 1 },
    ]);

    // The solver admits the broken floor instead of hiding the lock.
    expect(t.solve.minPairDeltaE).toBeLessThan(THRESHOLDS.minDeltaENormal);
    expect(t.solve.relaxations).toContain("minDeltaENormal");

    // And the audit fails the pair under normal vision.
    const audit = auditPalette(t.solve.palette, t.tokens.bg);
    const normal = audit.perVision.find((v) => v.mode === "normal");
    expect(normal?.pass).toBe(false);
    expect(audit.overall).not.toBe("pass");
  });

  it("marks a lock as unseated (slot: null) when N is below its position", () => {
    root.style.setProperty("--chart-cat-anchor-1", GRAY_A);
    root.style.setProperty("--chart-cat-anchor-2", GRAY_B);
    markAnchorEdited("light", 0);
    markAnchorEdited("light", 1);
    clearChartThemeCache();

    const t = getChartTheme("light", "comparative", 1);
    expect(t.solve.palette.map((c) => c.hex)).toEqual(["#777777"]);
    expect(t.anchorLocks).toEqual([
      { anchorIndex: 0, hex: "#777777", slot: 0 },
      { anchorIndex: 1, hex: "#797979", slot: null },
    ]);
  });

  it("keeps the no-override built-in path byte-identical (locks: [])", () => {
    const before = getChartTheme("light", "comparative", 4);
    expect(before.anchorLocks).toEqual([]);
    const beforeHexes = before.solve.palette.map((c) => c.hex);

    // Edit an anchor → the palette must change (the lock is real)…
    root.style.setProperty("--chart-cat-anchor-1", GRAY_A);
    markAnchorEdited("light", 0);
    clearChartThemeCache();
    const during = getChartTheme("light", "comparative", 4);
    expect(during.solve.palette[0].hex).toBe("#777777");
    expect(during.anchorLocks).toHaveLength(1);

    // …and resetting restores the exact built-in palette.
    clearEditedAnchors("light");
    root.style.setProperty("--chart-cat-anchor-1", ORIG_ANCHOR_1);
    clearChartThemeCache();
    expect(getEditedAnchorIndexes("light")).toEqual([]);
    const after = getChartTheme("light", "comparative", 4);
    expect(after.solve.palette.map((c) => c.hex)).toEqual(beforeHexes);
    expect(after.anchorLocks).toEqual([]);
  });
});

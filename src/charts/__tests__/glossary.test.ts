import { describe, it, expect } from "vitest";
import { GLOSSARY, lookup } from "@/charts/glossary";

/**
 * The glossary is the single source for both the ReferenceDrawer list and the
 * inline <Term> popovers. If they drift apart, a term defines itself one way
 * in place and another way in the drawer, which is worse than having no
 * glossary at all.
 */
describe("glossary", () => {
  it("keeps all twelve entries from the old panel", () => {
    expect(GLOSSARY).toHaveLength(12);
  });

  it("looks up by exact term", () => {
    expect(lookup("OKLab")?.short).toMatch(/color space/i);
  });

  it("returns undefined for an unknown term", () => {
    expect(lookup("nope")).toBeUndefined();
  });

  it("gives every entry a short and a longer detail", () => {
    for (const e of GLOSSARY) {
      expect(e.short.length, `${e.term} short`).toBeGreaterThan(0);
      expect(e.detail.length, `${e.term} detail`).toBeGreaterThan(e.short.length);
    }
  });

  it("has no duplicate terms", () => {
    const terms = GLOSSARY.map((e) => e.term);
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("resolves every term that PaletteVerdict wraps", () => {
    // These ids are hardcoded in PaletteVerdict's JSX. A typo there renders
    // plain text with no popover and no error, so pin them here.
    for (const id of ["ΔE (Delta-E)", "WCAG 2.2 SC 1.4.11", "Relaxation"]) {
      expect(lookup(id), id).toBeDefined();
    }
  });
});

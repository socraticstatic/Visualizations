import { describe, it, expect } from "vitest";
import { encodeUrlState, decodeUrlState, SECTION_IDS } from "@/charts/urlState";

describe("urlState", () => {
  it("round-trips a full state", () => {
    const s = {
      kind: "stacked-bar" as const,
      n: 7,
      theme: "dark" as const,
      vision: "deutan" as const,
      compare: true,
      kindB: "heatmap" as const,
      nB: 9,
      themeB: "light" as const,
    };
    const decoded = decodeUrlState("#" + encodeUrlState(s));
    expect(decoded).toMatchObject(s);
  });

  it("omits compare when false and parses without it", () => {
    const encoded = encodeUrlState({
      kind: "line",
      n: 3,
      theme: "light",
      vision: "normal",
      compare: false,
      kindB: "bar",
      nB: 4,
      themeB: "dark",
    });
    expect(encoded).not.toContain("c=1");
    const decoded = decodeUrlState(encoded);
    expect(decoded.compare).toBeUndefined();
  });

  it("returns empty object for empty hash", () => {
    expect(decodeUrlState("")).toEqual({});
    expect(decodeUrlState("#")).toEqual({});
  });
});

describe("hostile / malformed hash input", () => {
  it("drops a non-numeric n (#n=abc) instead of propagating NaN", () => {
    const decoded = decodeUrlState("#n=abc");
    expect(decoded.n).toBeUndefined();
  });

  it("drops out-of-range and non-integer n / nb values", () => {
    expect(decodeUrlState("#n=0").n).toBeUndefined();
    expect(decodeUrlState("#n=25").n).toBeUndefined();
    expect(decodeUrlState("#n=-3").n).toBeUndefined();
    expect(decodeUrlState("#n=3.5").n).toBeUndefined();
    expect(decodeUrlState("#n=Infinity").n).toBeUndefined();
    expect(decodeUrlState("#nb=99").nB).toBeUndefined();
    expect(decodeUrlState("#nb=abc").nB).toBeUndefined();
  });

  it("accepts the full valid n range 1..24", () => {
    expect(decodeUrlState("#n=1").n).toBe(1);
    expect(decodeUrlState("#n=24").n).toBe(24);
    expect(decodeUrlState("#nb=12").nB).toBe(12);
  });

  it("drops an unknown chart kind instead of crashing the page", () => {
    // BEST_PRACTICE[<bogus>] used to throw on first property access.
    expect(decodeUrlState("#k=bogus").kind).toBeUndefined();
    expect(decodeUrlState("#kb=bogus").kindB).toBeUndefined();
    expect(decodeUrlState("#k=line").kind).toBe("line");
    expect(decodeUrlState("#kb=heatmap").kindB).toBe("heatmap");
  });

  it("drops an unknown vision mode instead of silently simulating tritan", () => {
    expect(decodeUrlState("#v=bogus").vision).toBeUndefined();
    expect(decodeUrlState("#v=deutan").vision).toBe("deutan");
  });
});

describe("section deep-link", () => {
  const BASE = {
    kind: "line" as const,
    n: 2,
    theme: "light" as const,
    vision: "normal" as const,
    compare: false,
    kindB: "bar" as const,
    nB: 2,
    themeB: "dark" as const,
  };

  it("round-trips a section", () => {
    const decoded = decodeUrlState("#" + encodeUrlState({ ...BASE, section: "evidence" }));
    expect(decoded.section).toBe("evidence");
  });

  it("omits the key when no section is set", () => {
    expect(encodeUrlState(BASE)).not.toContain("s=");
  });

  it("ignores an unknown section value", () => {
    // A hand-edited or stale link must not put the nav in an impossible state.
    expect(decodeUrlState("#k=line&n=2&t=light&v=normal&s=bogus").section).toBeUndefined();
  });

  it("decodes every real section id", () => {
    for (const id of SECTION_IDS) {
      expect(decodeUrlState(`#s=${id}`).section).toBe(id);
    }
  });
});

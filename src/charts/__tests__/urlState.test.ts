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

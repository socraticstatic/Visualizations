import { describe, it, expect } from "vitest";
import { encodeUrlState, decodeUrlState } from "@/charts/urlState";

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

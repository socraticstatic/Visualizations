/**
 * Regression: the ColorPicker token write path must preserve the user's exact
 * hex. The old hexToHslTriple rounded H/S/L to integers — coarser than the
 * 1/255 RGB step — so #777777 came back as #787878 and the "locked verbatim"
 * promise in the anchor-lock status line was false.
 */
import { describe, it, expect } from "vitest";
import { hexToHslTriple, hslTripleToHex } from "@/components/charts/hslTriple";

function roundTrip(hex: string): string {
  return hslTripleToHex(hexToHslTriple(hex));
}

describe("hex → HSL triple → hex round-trip identity", () => {
  it("preserves the historically-shifted grays and a mixed color exactly", () => {
    // #777777 was the observed casualty (became #787878); #797979 is the
    // anchor-lock test's collision partner; #123456 exercises all channels.
    for (const hex of ["#777777", "#797979", "#123456"]) {
      expect(roundTrip(hex)).toBe(hex);
    }
  });

  it("preserves every gray (the tightest quantization band)", () => {
    for (let v = 0; v < 256; v++) {
      const b = v.toString(16).padStart(2, "0");
      const hex = `#${b}${b}${b}`;
      expect(roundTrip(hex)).toBe(hex);
    }
  });

  it("preserves channel extremes and primaries", () => {
    for (const hex of [
      "#000000",
      "#ffffff",
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#ffff00",
      "#00ffff",
      "#ff00ff",
      "#010101",
      "#fefefe",
      "#800000",
      "#008080",
    ]) {
      expect(roundTrip(hex)).toBe(hex);
    }
  });

  it("is identity across a deterministic 20k sample of the 16.7M hex space", () => {
    // Mulberry32 PRNG — fixed seed so failures reproduce.
    let s = 0xC0FFEE;
    const rand = () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < 20000; i++) {
      const n = Math.floor(rand() * 0x1000000);
      const hex = `#${n.toString(16).padStart(6, "0")}`;
      expect(roundTrip(hex)).toBe(hex);
    }
  });
});

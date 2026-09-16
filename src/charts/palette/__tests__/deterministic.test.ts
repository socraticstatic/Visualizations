/**
 * The replacements have to be right as well as reproducible.
 */
import { describe, expect, it } from "vitest";
import { ln, exp, pow, snap8, quantize } from "../deterministic";

describe("deterministic arithmetic", () => {
  it("agrees with the platform's ln to 1e-12", () => {
    for (let i = 1; i <= 2000; i++) {
      const x = i / 100;
      expect(Math.abs(ln(x) - Math.log(x))).toBeLessThan(1e-12);
    }
  });

  it("agrees with the platform's exp to 1e-12 relative", () => {
    for (let i = -600; i <= 600; i++) {
      const x = i / 10;
      const a = exp(x);
      const b = Math.exp(x);
      expect(Math.abs(a - b) / (b || 1)).toBeLessThan(1e-12);
    }
  });

  it("agrees with the platform's pow on the sRGB gamma exponents", () => {
    for (let i = 0; i <= 255; i++) {
      const v = i / 255;
      expect(Math.abs(pow(v, 2.4) - Math.pow(v, 2.4))).toBeLessThan(1e-12);
      expect(Math.abs(pow(v, 1 / 2.4) - Math.pow(v, 1 / 2.4))).toBeLessThan(1e-12);
    }
  });

  it("uses no implementation-defined Math function", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "deterministic.ts"), "utf8");
    // Comments stripped - the prose here names the very functions it
    // forbids, and a guard a comment can trip is not a guard.
    const body = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const banned of ["Math.pow", "Math.exp", "Math.log", "Math.cbrt", "Math.sin", "Math.cos", "**"]) {
      expect(body, banned).not.toContain(banned);
    }
  });

  it("snaps to the 8-bit grid the colour is actually rendered at", () => {
    expect(snap8(0.5)).toBeCloseTo(128 / 255, 12);
    expect(snap8(-1)).toBe(0);
    expect(snap8(2)).toBe(1);
    // Idempotent: snapping a snapped value cannot move it.
    for (let i = 0; i <= 255; i++) expect(snap8(snap8(i / 255))).toBe(i / 255);
  });

  it("quantises onto a grid far below the smallest threshold it must not cross", () => {
    expect(quantize(0.1234567891)).toBe(0.123457);
    expect(quantize(quantize(0.9999994))).toBe(quantize(0.9999994));
  });
});

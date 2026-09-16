import { describe, it, expect } from "vitest";
import { contrastRatio } from "@engine/audit";
import { DEFAULT_TOKENS } from "./defaults";

const THEMES = ["light", "dark"] as const;

describe("DEFAULT_TOKENS", () => {
  it("defines the same keys in both themes", () => {
    expect(Object.keys(DEFAULT_TOKENS.light).sort()).toEqual(Object.keys(DEFAULT_TOKENS.dark).sort());
  });

  it.each(THEMES)("%s: label text clears 4.5:1 on its own surface", (theme) => {
    const t = DEFAULT_TOKENS[theme];
    expect(contrastRatio(t.label, t.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("%s: grid and axis clear the 3:1 non-text floor", (theme) => {
    const t = DEFAULT_TOKENS[theme];
    expect(contrastRatio(t.grid, t.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t.axis, t.surface)).toBeGreaterThanOrEqual(3);
  });

  it("orients the light surface lighter than the dark surface", () => {
    expect(DEFAULT_TOKENS.light.surface.oklab.l).toBeGreaterThan(DEFAULT_TOKENS.dark.surface.oklab.l);
  });
});

/**
 * theme.css and UI_FALLBACK must not drift. The stylesheet is where the colour
 * actually reaches the screen; the tokens module is where it is audited. If they
 * disagree, the audit is measuring something the user never sees.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UI_FALLBACK, FIGMA_VAR, type UiTokens } from "./uiTokens";

const here = fileURLToPath(new URL(".", import.meta.url));
const CSS = readFileSync(resolve(here, "../ui/theme.css"), "utf8");

const KEYS = Object.keys(UI_FALLBACK.light) as Array<keyof UiTokens>;

describe("theme.css matches the audited fallbacks", () => {
  it.each(KEYS)("light %s uses its Figma variable and audited fallback", (key) => {
    const expected = `var(${FIGMA_VAR[key]}, ${UI_FALLBACK.light[key].hex})`;
    expect(CSS).toContain(expected);
  });

  it.each(KEYS.filter((k) => k !== "textOnBrand"))(
    "dark %s uses its Figma variable and audited fallback",
    (key) => {
      const expected = `var(${FIGMA_VAR[key]}, ${UI_FALLBACK.dark[key].hex})`;
      expect(CSS).toContain(expected);
    }
  );

  it("never sets a bare colour that bypasses the token layer", () => {
    // Any hex outside a var() fallback is an unaudited colour.
    const bare = CSS.match(/(?<!, )#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(bare).toEqual([]);
  });
});

describe("interactive boundaries use the audited border", () => {
  /**
   * --ui-border is a decorative divider and is NOT audited to 3:1.
   * --ui-border-strong is. Controls must use the latter, or their hit target
   * disappears against the panel. Measured live in dark theme at 1.43:1 before
   * this rule existed.
   */
  const INTERACTIVE = [".tab", ".btn--quiet"];

  it.each(INTERACTIVE)("%s does not use the decorative border token", (selector) => {
    const block = CSS.slice(CSS.indexOf(`${selector} {`));
    const body = block.slice(0, block.indexOf("}"));
    expect(body).not.toMatch(/border[^;]*var\(--ui-border[,)]/);
  });
});

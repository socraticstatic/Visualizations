/**
 * Source guards for the /charts masthead.
 *
 * The defect these pin was optical, not functional, so jsdom cannot see it:
 * the evidence link was the last phrase of the lead paragraph, underlined at a
 * 4px offset, and the next paragraph started 8px below the link box. Measured
 * in the browser: link bottom 227, next paragraph top 235. The underline and
 * the following line of body copy read as one run-on block.
 *
 * The fix is structural - the link is its own affordance in its own row - so
 * the structure is what gets pinned.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "..", "pages", "ChartsDemo.tsx"), "utf8");

const RAW = SRC.slice(SRC.indexOf("<header"), SRC.indexOf("</header>"));

/**
 * Comments stripped before anything is scanned. A guard that reads prose will
 * eventually trip on a comment explaining the very thing it forbids - the
 * masthead's own comment names the link and the version chip these tests check
 * the placement of. Blanked rather than deleted, so every offset below still
 * points at the same character of markup.
 */
const MASTHEAD = RAW.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) =>
  m.replace(/[^\n]/g, " ")
);

/** Every <p> ... </p> in the masthead, tag included. */
const PARAGRAPHS = [...MASTHEAD.matchAll(/<p\b[\s\S]*?<\/p>/g)].map((m) => m[0]);

describe("charts masthead", () => {
  it("has a masthead at all", () => {
    expect(MASTHEAD).toContain("Micah's Chart System");
    expect(PARAGRAPHS.length).toBeGreaterThan(0);
  });

  it("keeps the evidence link out of the running copy", () => {
    const lead = PARAGRAPHS.find((p) => p.includes("audits before you ship"));
    expect(lead).toBeDefined();
    // Inline, the link's underline landed 6px of ink above the next line.
    expect(lead).not.toContain("<Link");
  });

  it("gives the evidence link its own row, clear of the paragraph above", () => {
    const row = MASTHEAD.slice(MASTHEAD.indexOf("palette-contrast-benchmark"));
    expect(row).toContain("Read the finding");
    // The row's own top margin is what buys the separation.
    const rowOpen = MASTHEAD.lastIndexOf("<div", MASTHEAD.indexOf("palette-contrast-benchmark"));
    expect(MASTHEAD.slice(rowOpen, rowOpen + 200)).toMatch(/className="mt-[5-9] flex/);
  });

  it("puts the version in the kicker, not mid-sentence", () => {
    const version = MASTHEAD.indexOf("v{PALETTE_VERSION}");
    expect(version).toBeGreaterThan(-1);
    expect(version).toBeLessThan(MASTHEAD.indexOf("<h1"));
    expect(PARAGRAPHS.some((p) => p.includes("PALETTE_VERSION"))).toBe(false);
  });

  it("drops the deck onto its own line instead of wrapping mid-phrase", () => {
    const h1 = MASTHEAD.slice(MASTHEAD.indexOf("<h1"), MASTHEAD.indexOf("</h1>"));
    expect(h1).toContain("for Sane and Useful Color Strategies");
    expect(h1).toMatch(/<span className="[^"]*\bblock\b/);
  });
});

/**
 * Source guards for the plugin promo block.
 *
 * These are deliberately source-level rather than render-level: the defect
 * they protect against is a layout one that jsdom cannot reproduce, because
 * jsdom has no scrollWidth. It was found in a real browser and is pinned here
 * so it cannot come back silently.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(__dirname, "..", "..", "components", "charts", "PluginPromo.tsx"),
  "utf8"
);

/** Only the class names, so a comment explaining a fix cannot trip a guard. */
const CLASSES = [...SRC.matchAll(/className="([^"]*)"/g)].map((m) => m[1]);
const ALL_CLASSES = CLASSES.join(" ");

describe("PluginPromo layout guards", () => {
  it("clips rather than hides, so the block can never become a scroll container", () => {
    // overflow-hidden made the block scrollable by the width of the
    // decorative glow. Focusing the CTA, or any scrollIntoView on a
    // descendant, then slid the entire block's content 112px left under the
    // clip - measured in the browser as scrollLeft 112, scrollWidth 1329 vs
    // clientWidth 1217.
    expect(ALL_CLASSES).toContain("overflow-clip");
    expect(ALL_CLASSES).not.toContain("overflow-hidden");
  });

  it("keeps decoration inside the box, so there is no overflow to scroll", () => {
    // A negative offset adds scrollable overflow even while clipped, which is
    // what created the bug above.
    const negativeInsets = CLASSES.filter((c) =>
      /(?:^|\s)-(?:top|right|bottom|left)-/.test(c)
    );
    expect(negativeInsets).toEqual([]);
  });

  it("scales each strip from a fixed viewBox, so markers stay round at any N", () => {
    // Per-slot svgs stretched to fill a flex track turned every circle into an
    // ellipse; sizing the viewBox as n * slotWidth instead made a two-series
    // strip scale up to half again its intended height.
    expect(SRC).toContain("viewBox={`0 0 ${STRIP_W} ${ROW_H}`}");
    expect(SRC).not.toContain('preserveAspectRatio="none"');
  });

  it("points the buy link at the live payment link", () => {
    expect(SRC).toContain("https://buy.stripe.com/fZu00jedrdoY9zrgWTfAc00");
  });
});

# chart-color-system

Chart palettes that are audited before you ship them, not after someone files a bug.

Generates categorical, sequential, and diverging palettes and checks every one against
WCAG non-text contrast, color-vision-deficiency simulation (deutan / protan / tritan /
achromatopsia), and grayscale. Every color slot is paired 1:1 with a dash pattern, a
decal, and a marker shape, so series stay identifiable when color fails.

**Honesty note:** past roughly six hues, no palette keeps colors reliably distinct under
dichromacy. The CVD/ΔE floors are deliberately minimal at high N, and the redundant
dash / decal / shape channels are what actually carry series identity there. This library
tells you when that line is crossed instead of pretending it isn't.

For context on why this matters: of five widely used chart palettes, four fail the 3:1
WCAG non-text contrast floor on a white background at their worst slot — Tableau 10 at
1.61:1 (#EDC948), ColorBrewer Set2 at 1.38:1 (#FFD92F), Observable 10 at 1.91:1, and
Material 700 at 1.66:1. Only IBM Carbon clears it, at 3.33:1.

## Install

```bash
npm install chart-color-system culori
```

`culori` is a peer dependency so it dedupes against your copy.

## Usage

```js
import {
  solveCategorical,
  auditPalette,
  fromCss,
  dashScale,
  shapeScale,
} from "chart-color-system";

const background = fromCss("#ffffff");
const grid = fromCss("#e5e7eb");

const solved = solveCategorical({
  n: 8,
  posture: "comparative",  // "kpi" | "comparative" | "exploratory"
  background,
  grid,                    // colors are pushed away from your gridlines too
  locks: [],               // brand anchors in slot order; [] to solve freely
});

const report = auditPalette(solved.palette, background);

console.log(report.overall);            // "pass" | "warn" | "fail"
console.log(report.worstContrastVsBg);  // worst slot contrast vs. background
console.log(report.perVision);          // normal / deutan / protan / tritan / achromatopsia
console.log(solved.relaxations);        // which floors gave, and in what order

// Pair each slot with its non-color channels.
solved.palette.forEach((color, i) => {
  console.log(color.hex, dashScale[i], shapeScale[i]);
});
```

Auditing a sequential or diverging ramp? Pass `true` as the third argument so pairwise
ΔE separation is skipped — gradient stops are meant to be perceptually close, and scoring
them pairwise would flag every correct ramp as failing:

```js
const ramp = sequentialRamp(fromCss("#f0f9ff"), fromCss("#0c4a6e"), 9);
const rampReport = auditPalette(ramp, background, true);
```

## What's exported

| Area | Exports |
|---|---|
| Solvers | `solveCategorical`, `sequentialRamp`, `divergingRamp`, `stableAssign` |
| Audit | `auditPalette`, `simulateColor`, `contrastRatio` |
| CVD | `simulateRgb`, `CVD_TYPES` |
| Color | `fromCss`, `fromHsl`, `fromCssVar`, `deltaE`, `deltaL`, `cvdDeltaE` |
| Gamut | `reduceToSrgb`, `oklchToRgb`, `oklchOf` |
| Constraints | `POSTURE`, `THRESHOLDS`, `RELAXATION_ORDER`, `CVD_SEVERITY`, `PALETTE_SEED` |
| Encodings | `dashScale`, `decalScale`, `shapeScale`, `MAX_SLOTS` |
| Version | `PALETTE_VERSION` |

Math is OKLab. The solver is seeded, so the same input always gives the same palette.
The engine does no DOM work — the one exception is `fromCssVar`, which reads a custom
property off a live element and is therefore browser-only.

The package version tracks `PALETTE_VERSION`: a version bump means the colors may have
moved.

## Interactive builder

Pick a chart type and an N, watch the audit update, and export the tokens:
**<https://github.com/socraticstatic/Visualizations>**

## Sponsor

If this saves you a week of arguing about chart colors:
**<https://github.com/sponsors/socraticstatic>**

## License

MIT © Micah Boswell

The palette engine in this package is MIT. The interactive builder application it was
extracted from is proprietary and not included here.


## Attribution

MIT requires the copyright and license text to travel with the code. If
chart-color-system ships inside a commercial or enterprise product, also
credit **Micah Boswell — Chart Color System**
(https://socraticstatic.github.io/Visualizations/) in your documentation,
about screen, or credits.

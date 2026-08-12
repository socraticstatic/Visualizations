# The palette that fails worst on white is the best on dark

Five categorical palettes turn up as defaults or house standards across common charting tools: Tableau 10, IBM Carbon, ColorBrewer Set2, Observable 10, and Material Design's 700 series. I measured all five against WCAG's 3:1 non-text contrast floor.

On a white background, four of the five fail.

| Palette | N | Worst contrast | Slots below 3:1 |
|---|---|---|---|
| IBM Carbon | 10 | 3.33:1 | 0 / 10 |
| Observable 10 | 10 | 1.91:1 | 6 / 10 |
| Material 700 | 10 | 1.66:1 | 2 / 10 |
| Tableau 10 | 10 | 1.61:1 | 5 / 10 |
| ColorBrewer Set2 | 8 | 1.38:1 | 8 / 8 |

Every slot in ColorBrewer Set2 falls below the floor. Its worst, `#FFD92F`, lands at 1.38:1.

Now change the background to `#111827` and run it again.

| Palette | Worst contrast | Slots below 3:1 |
|---|---|---|
| ColorBrewer Set2 | 6.78:1 | 0 / 8 |
| Tableau 10 | 3.90:1 | 0 / 10 |
| Observable 10 | 3.52:1 | 0 / 10 |
| Material 700 | 1.90:1 | 3 / 10 |
| IBM Carbon | 1.20:1 | 5 / 10 |

The order nearly reverses. Set2 goes from worst to best. Carbon goes from the only passing palette to the worst one, with half its slots failing.

## These palettes are correct, for one background each

Set2 is a light palette, and it separates cleanly on dark ground. Cynthia Brewer and Mark Harrower launched ColorBrewer in 2002 at Penn State for cartographers, with print reproduction and color-vision deficiency as explicit design goals. On a map the marks are large filled regions, not one-pixel strokes, and a large region at 1.38:1 is a different proposition from a hairline. Carbon's slots are deep and saturated, which is why they sit well on white and vanish on charcoal.

Neither palette is broken. Both are answers to a question nobody asks out loud, which is: what am I drawing this on?

The defaults do not carry that answer. You pick a scheme by name, your design system flips to dark mode a year later, and the palette silently stops meeting the floor. Nothing errors. The chart still renders. It just stops being readable for some of the people looking at it.

## What 3:1 does and does not require

WCAG 2.2 SC 1.4.11 asks for 3:1 against adjacent colors for graphical objects needed to understand the content. Applied to charts, that covers the marks a reader must distinguish to read the data.

The rule is narrower than the numbers above suggest, and the counterargument deserves stating plainly. A palette slot next to a text label in a legend is identifiable from the label. A large filled region carries its own edge. The criterion exempts presentations where the specific appearance is essential to the information.

So a failing number in these tables is not automatically a violation. What it is, reliably, is a 2px line at 1.38:1 that a reader with low vision cannot follow across a busy plot. Whether that counts as a conformance failure depends on your chart. Whether it counts as a usability failure does not.

Measure your own marks at their real rendered size. The tables tell you where to look, not what to conclude.

## Contrast and hue separation are different problems

Qualitative palettes optimize for distance between colors. They are built so slot 3 does not read as slot 7. That is separation within the palette.

Contrast is separation from the background. A palette can be excellent at the first and indifferent to the second, because the second depends on a variable the palette author never had.

This is why the two tables disagree. Set2's colors are well spread from each other in both, with a minimum pairwise ΔE of 11.8 at N=6. What changes is only the ground beneath them.

## Color-vision deficiency is the harder failure

Contrast at least has a threshold you can compute. Distinctness under dichromacy degrades faster and with less warning.

At N=6 on white, simulating deutan, protan, and tritan vision and taking the worst case:

| Palette | Min pairwise ΔE | Worst CVD ΔE |
|---|---|---|
| IBM Carbon | 19.3 | 6.3 |
| Tableau 10 | 13.9 | 0.7 |
| ColorBrewer Set2 | 11.8 | 1.5 |
| Observable 10 | 11.3 | 2.0 |
| Material 700 | 10.7 | 2.8 |

Tableau 10 spreads its first six hues across a ΔE of 13.9. Under deutan simulation two of those six collapse to 0.7 apart. For a red-green colorblind reader, that is one color drawn twice.

Past roughly six hues, no palette holds up. I have not found one that does, and I do not believe one exists. Beyond that point, color stops being a reliable channel and something else has to carry series identity: dash pattern, decal fill, marker shape.

## Why the background is the part I kept hitting

I did not arrive at this from color theory. Most of my work has been dashboards for
operations people: nuclear at Acumen, energy at CenterPoint Energy, networks at AT&T.
The range those have to cover runs from a phone held in daylight to a wall-mounted
display in a control room kept at low light.

That is the inversion in the first two tables, met on the job rather than in a
spreadsheet. A palette signed off on a white mockup goes up on the control room wall,
and the light slots go with it. The failure does not announce itself. The chart still
renders, and the operator quietly starts reading position and label instead of color.

Which is the tell. When people stop trusting the color channel, they route around it,
and you never hear about it as a color problem.

## What I built, and where it loses

I wrote a solver that treats the background as an input instead of an assumption. Give it an N, a posture, a background, and your gridline color, and it returns a palette audited against contrast, CVD, and grayscale before you ship it.

At N=6 on white it reaches 4.40:1 worst contrast with zero failing slots, and a worst-case CVD ΔE of 8.6. Both beat all five published palettes at that N. Its minimum pairwise ΔE of 15.3 beats four of them and loses to IBM Carbon's 19.3, which spreads its hues further than my solver does.

At N=10 it does not. Worst contrast holds at 4.06:1 with zero failures, but minimum pairwise ΔE drops to 4.0, well under Tableau 10's 8.4. The solver buys contrast compliance with hue spread, and above six slots the price gets steep.

That is the same wall as everyone else's. I did not solve it. What the tool does is tell you when you have hit it, and pair every slot with a dash, a decal, and a shape so the chart survives the moment color gives out.

## Reproduce this

The engine is MIT.

```bash
npm install chart-color-system culori
```

```js
import { fromCss, contrastRatio } from "chart-color-system";

const bg = fromCss("#ffffff");
const set2 = ["#66C2A5","#FC8D62","#8DA0CB","#E78AC3",
              "#A6D854","#FFD92F","#E5C494","#B3B3B3"];

set2.map(fromCss).forEach((c, i) => {
  const r = contrastRatio(c, bg);
  console.log(set2[i], r.toFixed(2) + ":1", r < 3 ? "FAIL" : "pass");
});
```

Every number in this post comes from that package. The palette hexes are copied verbatim from each system's published spec.

If you would rather move a slider than write a loop, the [interactive builder](https://socraticstatic.github.io/Visualizations/) runs the same solver and audit in the browser, with CVD simulation and a grayscale check on every palette it produces. Source is on [GitHub](https://github.com/socraticstatic/Visualizations).

Run it against your own background before you argue with the tables. That is the point.

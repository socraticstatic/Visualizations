import { useMemo } from "react";
import { Link } from "react-router";
import { BENCHMARKS } from "@/charts/benchmarks";
import { fromCss, deltaE, type ColorRecord } from "@/charts/palette/distance";
import { contrastRatio, simulateColor, type VisionMode } from "@/charts/audit";
import { solveCategorical } from "@/charts/palette/categorical";
import { Prose } from "@/components/blog/BlogLayout";

/**
 * Every figure in this post is computed at render time from the same engine the
 * builder uses, against the same BENCHMARKS constants. Nothing is transcribed,
 * so the post cannot drift from the solver when the palette version moves.
 */

const WHITE = "#ffffff";
const DARK = "#111827";
const FLOOR = 3;
const CVD_MODES: VisionMode[] = ["deutan", "protan", "tritan"];

function ratios(hexes: string[], bg: ColorRecord) {
  return hexes.map((hex) => ({ hex, ratio: contrastRatio(fromCss(hex), bg) }));
}

function minPairDeltaE(colors: ColorRecord[]) {
  let min = Infinity;
  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++) min = Math.min(min, deltaE(colors[i], colors[j]));
  return min;
}

function worstCvdDeltaE(colors: ColorRecord[]) {
  let worst = Infinity;
  for (const mode of CVD_MODES) {
    const sim = colors.map((c) => simulateColor(c, mode));
    worst = Math.min(worst, minPairDeltaE(sim));
  }
  return worst;
}

/** Filled square = below the floor. Never hue alone: this post argues against that. */
function Marker({ fails }: { fails: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 border-[1.5px] border-current ${
        fails ? "bg-current" : "bg-transparent"
      }`}
    />
  );
}

function Swatches({ hexes }: { hexes: string[] }) {
  return (
    <span className="mt-1.5 flex gap-0.5" aria-hidden>
      {hexes.map((h) => (
        <span key={h} className="h-3 w-1.5 rounded-[1px]" style={{ background: h }} />
      ))}
    </span>
  );
}

/** Plain magnitude bar, scaled by the caller against its column's maximum. */
function Bar({ pct }: { pct: number }) {
  return (
    <span aria-hidden className="mt-1.5 block h-[4px] w-full rounded-sm bg-foreground/10">
      <span
        className="block h-full rounded-sm bg-foreground/45"
        style={{ width: `${Math.min(100, pct)}%`, minWidth: 2 }}
      />
    </span>
  );
}

/**
 * Contrast bar with the 3:1 floor drawn on it.
 *
 * A bare magnitude bar is decoration here - the reader does not care how long
 * 1.61 is, they care which side of the floor it falls on. Both tables share one
 * scale so a row can be compared across backgrounds, not just within a table.
 */
const CONTRAST_SCALE = 8;

function ContrastBar({ ratio }: { ratio: number }) {
  const pass = ratio >= FLOOR;
  return (
    <span aria-hidden className="relative mt-1.5 block h-[6px] w-full rounded-sm bg-foreground/10">
      <span
        className={`block h-full rounded-sm ${pass ? "bg-foreground/55" : "bg-foreground/25"}`}
        style={{ width: `${Math.min(100, (ratio / CONTRAST_SCALE) * 100)}%`, minWidth: 2 }}
      />
      <span
        className="absolute top-[-2px] h-[10px] w-px bg-foreground/70"
        style={{ left: `${(FLOOR / CONTRAST_SCALE) * 100}%` }}
        title="3:1 floor"
      />
    </span>
  );
}

/**
 * Table shell. Rules from Roselli / Inclusive Components / WebAIM:
 *
 * - `scope` on every header cell, column and row, so a screen reader announces
 *   the column when you arrow across and the palette when you arrow down.
 * - Visible `<caption>` as the table's first child. It is what gets announced
 *   when a screen reader user jumps here with the `T` key, so a `<p>` above the
 *   table is not a substitute and `sr-only` throws away the sighted half.
 * - Proportional widths only. Fixed pixel columns force horizontal scrolling
 *   the moment a low-vision reader zooms.
 *
 * There is no scroll container, and there must never be one. A table that does
 * not fit is an information-design problem, and wrapping it in `overflow-x`
 * just hands that problem to the reader to solve by dragging. Three columns,
 * proportionally sized, fit a 375px viewport. If a future column will not fit,
 * cut a redundant one or restructure the whole thing - do not add a scrollbar.
 */
const Table = ({
  caption,
  head,
  children,
}: {
  caption: string;
  head: string[];
  children: React.ReactNode;
}) => (
  <table className="w-full border-collapse text-left">
    <caption className="pb-3 text-left text-xs leading-relaxed text-chart-muted-text">
      {caption}
    </caption>
    <thead>
      <tr className="border-b border-foreground/50">
        {head.map((h, i) => (
          <th
            key={h}
            scope="col"
            className={`py-2 align-bottom text-[11px] font-medium uppercase tracking-wide text-chart-muted-text ${
              i === 0 ? "pr-3" : "pl-3 text-right"
            }`}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>{children}</tbody>
  </table>
);

/**
 * One semantic table, sized to fit a phone without scrolling.
 *
 * The earlier draft carried five columns and had to scroll sideways on mobile.
 * Two of them were redundant: "slots" is already the denominator of "5 / 10",
 * and a verdict column only restates whether that numerator is zero. Cutting
 * them is what makes the table fit, so there is no scroll container and no
 * duplicate card markup shadowing the same data.
 */
function ContrastTable({ bgHex, caption }: { bgHex: string; caption: string }) {
  const rows = useMemo(() => {
    const bg = fromCss(bgHex);
    return BENCHMARKS.map((b) => {
      const rs = ratios(b.hexes, bg);
      return {
        name: b.name,
        hexes: b.hexes,
        worst: Math.min(...rs.map((r) => r.ratio)),
        below: rs.filter((r) => r.ratio < FLOOR).length,
        n: b.hexes.length,
      };
    }).sort((a, b) => b.worst - a.worst);
  }, [bgHex]);

  return (
    <figure className="my-10">
      <Table caption={caption} head={["Palette", "Worst contrast", "Slots below 3:1"]}>
        {rows.map((r) => (
          <tr key={r.name} className="border-b border-chart-grid last:border-0">
            <th scope="row" className="py-3 pr-3 align-top font-normal">
              <span className="block text-sm font-medium leading-tight text-foreground">
                {r.name}
              </span>
              <Swatches hexes={r.hexes} />
            </th>
            <td className="py-3 pl-3 align-top text-right text-sm tabular-nums text-foreground">
              {r.worst.toFixed(2)}:1
              <ContrastBar ratio={r.worst} />
            </td>
            <td className="py-3 pl-3 align-top text-right text-sm tabular-nums text-foreground">
              <span className="inline-flex items-center gap-2">
                <Marker fails={r.below > 0} />
                <span>
                  {r.below} of {r.n}
                </span>
              </span>
              <span className="sr-only">{r.below > 0 ? " - fails the floor" : " - clears the floor"}</span>
            </td>
          </tr>
        ))}
      </Table>
    </figure>
  );
}

/** The argument is about hairlines, so the specimen is an actual 2px stroke. */
function SpecimenPlate({ bgHex, label }: { bgHex: string; label: string }) {
  const set2 = BENCHMARKS.find((b) => b.id === "set2")!;
  const rows = useMemo(() => ratios(set2.hexes, fromCss(bgHex)), [bgHex, set2.hexes]);
  const below = rows.filter((r) => r.ratio < FLOOR).length;
  const light = bgHex.toLowerCase() === WHITE;

  return (
    <div className="p-4 sm:p-5" style={{ background: bgHex }}>
      <p
        className="mb-4 flex justify-between gap-3 text-[10px] uppercase tracking-wider"
        style={{ color: light ? "#6B7280" : "#9CA3AF" }}
      >
        <span>{label}</span>
        <span>
          {below} / {rows.length} below
        </span>
      </p>
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.hex} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <span className="h-[2px] rounded-sm" style={{ background: r.hex }} />
            <span
              className="flex items-center gap-1.5 whitespace-nowrap text-[11px] tabular-nums"
              style={{ color: light ? "#4B5563" : "#D1D5DB" }}
            >
              <span
                aria-hidden
                className={`inline-block h-[7px] w-[7px] border-[1.5px] border-current ${
                  r.ratio < FLOOR ? "bg-current" : "bg-transparent"
                }`}
              />
              {r.ratio.toFixed(2)}:1
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CvdTable() {
  const rows = useMemo(() => {
    return BENCHMARKS.map((b) => {
      const colors = b.hexes.slice(0, 6).map(fromCss);
      return { name: b.name, pair: minPairDeltaE(colors), cvd: worstCvdDeltaE(colors) };
    }).sort((a, b) => b.cvd - a.cvd);
  }, []);
  const maxPair = Math.max(...rows.map((r) => r.pair));
  const maxCvd = Math.max(...rows.map((r) => r.cvd));

  return (
    <figure className="my-10">
      <Table
        caption="At N=6 on white, worst case across deutan, protan, and tritan. Higher is better in both columns; bars are scaled within each column."
        head={["Palette", "Min pairwise ΔE", "Worst CVD ΔE"]}
      >
        {rows.map((r) => (
          <tr key={r.name} className="border-b border-chart-grid last:border-0">
            <th scope="row" className="py-3 pr-3 align-top text-sm font-medium text-foreground">
              {r.name}
            </th>
            <td className="py-3 pl-3 align-top text-right text-sm tabular-nums text-foreground">
              {r.pair.toFixed(1)}
              <Bar pct={(r.pair / maxPair) * 100} />
            </td>
            <td className="py-3 pl-3 align-top text-right text-sm tabular-nums text-foreground">
              {r.cvd.toFixed(1)}
              <Bar pct={(r.cvd / maxCvd) * 100} />
            </td>
          </tr>
        ))}
      </Table>
    </figure>
  );
}

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-12 border-b border-chart-grid pb-2 text-xs font-semibold uppercase tracking-wider text-primary">
    {children}
  </h2>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-4 text-[15px] leading-relaxed text-foreground/90">{children}</p>
);

export default function PaletteContrastBenchmark() {
  const facts = useMemo(() => {
    const white = fromCss(WHITE);
    const dark = fromCss(DARK);
    const set2 = BENCHMARKS.find((b) => b.id === "set2")!;
    const set2White = ratios(set2.hexes, white);
    const set2Dark = ratios(set2.hexes, dark);
    const worstSlot = set2White.reduce((a, b) => (a.ratio < b.ratio ? a : b));
    const carbon = BENCHMARKS.find((b) => b.id === "carbon")!;
    const carbonDark = ratios(carbon.hexes, dark);
    const failingOnWhite = BENCHMARKS.filter((b) =>
      ratios(b.hexes, white).some((r) => r.ratio < FLOOR)
    ).length;

    const solved6 = solveCategorical({
      n: 6,
      posture: "comparative",
      background: white,
      grid: fromCss("#e5e7eb"),
      locks: [],
    });

    return {
      failingOnWhite,
      total: BENCHMARKS.length,
      worstSlot,
      set2WhiteBelow: set2White.filter((r) => r.ratio < FLOOR).length,
      set2N: set2.hexes.length,
      set2DarkWorst: Math.min(...set2Dark.map((r) => r.ratio)),
      carbonDarkBelow: carbonDark.filter((r) => r.ratio < FLOOR).length,
      carbonN: carbon.hexes.length,
      solved6Worst: Math.min(...solved6.palette.map((c) => contrastRatio(c, white))),
      solved6Cvd: worstCvdDeltaE(solved6.palette),
      solved6Pair: minPairDeltaE(solved6.palette),
    };
  }, []);

  return (
    <article className="pb-4">
      <Prose>
        <P>
          Five categorical palettes turn up as defaults or house standards across common charting
          tools. Measured on a white background, {facts.failingOnWhite} of the {facts.total} fall
          below the 3:1 non-text contrast floor in WCAG 2.2 SC 1.4.11. Change the background and the
          ranking nearly inverts.
        </P>
      </Prose>

      <figure className="my-8">
        <div className="mx-auto grid max-w-[1100px] gap-px overflow-hidden border-y border-chart-grid bg-chart-grid px-0 sm:grid-cols-2 sm:rounded-lg sm:border">
          <SpecimenPlate bgHex={WHITE} label={`ColorBrewer Set2 on ${WHITE}`} />
          <SpecimenPlate bgHex={DARK} label={`ColorBrewer Set2 on ${DARK}`} />
        </div>
        <figcaption className="mx-auto mt-2 max-w-[1100px] px-4 text-[11px] text-chart-muted-text sm:px-6">
          Each specimen is a 2px stroke at the size these palettes are actually drawn. Same eight
          colors, both grounds.
        </figcaption>
      </figure>

      <Prose>
        <P>
          Every slot in ColorBrewer Set2 falls below the floor on white. Its worst,{" "}
          <code className="rounded bg-chart-grid/40 px-1 py-0.5 text-[13px]">
            {facts.worstSlot.hex.toUpperCase()}
          </code>
          , lands at {facts.worstSlot.ratio.toFixed(2)}:1. Move the same palette to {DARK} and
          nothing fails, with the worst slot at {facts.set2DarkWorst.toFixed(2)}:1.
        </P>
        <P>
          IBM Carbon does the opposite. It is the only one of the five that clears the floor on
          white, and on dark {facts.carbonDarkBelow} of its {facts.carbonN} slots drop below it.
        </P>
      </Prose>

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <ContrastTable bgHex={WHITE} caption={`On ${WHITE} · full palette length`} />
        <ContrastTable bgHex={DARK} caption={`On ${DARK} · same palettes, same slots`} />
      </div>

      <Prose>
        <H2>These palettes are correct, for one background each</H2>
        <P>
          Set2 is a light palette, and it separates cleanly on dark ground. Cynthia Brewer and Mark
          Harrower launched ColorBrewer in 2002 at Penn State for cartographers, with print
          reproduction and color-vision deficiency as explicit design goals. On a map the marks are
          large filled regions, not one-pixel strokes, and a large region at{" "}
          {facts.worstSlot.ratio.toFixed(2)}:1 is a different proposition from a hairline. Carbon's
          slots are deep and saturated, which is why they sit well on white and vanish on charcoal.
        </P>
        <P>
          Neither palette is broken. Both are answers to a question nobody asks out loud, which is:
          what am I drawing this on?
        </P>
        <P>
          The defaults do not carry that answer. You pick a scheme by name, your design system flips
          to dark mode a year later, and the palette silently stops meeting the floor. Nothing
          errors. The chart still renders. It just stops being readable for some of the people
          looking at it.
        </P>

        <H2>What 3:1 does and does not require</H2>
        <P>
          SC 1.4.11 asks for 3:1 against adjacent colors for graphical objects needed to understand
          the content. Applied to charts, that covers the marks a reader must distinguish to read
          the data.
        </P>
        <P>
          The rule is narrower than the numbers above suggest, and the counterargument deserves
          stating plainly. A palette slot next to a text label in a legend is identifiable from the
          label. A large filled region carries its own edge. The criterion exempts presentations
          where the specific appearance is essential to the information.
        </P>
        <p className="mt-4 border-l-2 border-primary pl-4 text-[15px] leading-relaxed text-chart-muted-text">
          So a failing number in these tables is not automatically a violation. What it is,
          reliably, is a 2px line at {facts.worstSlot.ratio.toFixed(2)}:1 that a reader with low
          vision cannot follow across a busy plot. Whether that counts as a conformance failure
          depends on your chart. Whether it counts as a usability failure does not.
        </p>
        <P>
          Measure your own marks at their real rendered size. The tables tell you where to look, not
          what to conclude.
        </P>

        <H2>Contrast and hue separation are different problems</H2>
        <P>
          Qualitative palettes optimize for distance between colors. They are built so slot 3 does
          not read as slot 7. That is separation within the palette.
        </P>
        <P>
          Contrast is separation from the background. A palette can be excellent at the first and
          indifferent to the second, because the second depends on a variable the palette author
          never had.
        </P>

        <H2>Color-vision deficiency is the harder failure</H2>
        <P>
          Contrast at least has a threshold you can compute. Distinctness under dichromacy degrades
          faster and with less warning.
        </P>
      </Prose>

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <CvdTable />
      </div>

      <Prose>
        <P>
          Tableau 10 spreads its first six hues across a wide ΔE. Under deutan simulation two of
          those six collapse to under 1 apart. For a red-green colorblind reader, that is one color
          drawn twice.
        </P>
        <P>
          Past roughly six hues, no palette holds up. I have not found one that does, and I do not
          believe one exists. Beyond that point, color stops being a reliable channel and something
          else has to carry series identity: dash pattern, decal fill, marker shape.
        </P>

        <H2>Why the background is the part I kept hitting</H2>
        <P>
          I did not arrive at this from color theory. Most of my work has been dashboards for
          operations people: nuclear at Acumen, energy at CenterPoint Energy, networks at AT&amp;T.
          The range those have to cover runs from a phone held in daylight to a wall-mounted display
          in a control room kept at low light.
        </P>
        <P>
          That is the inversion in the first two tables, met on the job rather than in a spreadsheet.
          A palette signed off on a white mockup goes up on the control room wall, and the light
          slots go with it. The failure does not announce itself. The chart still renders, and the
          operator quietly starts reading position and label instead of color.
        </P>
        <P>
          Which is the tell. When people stop trusting the color channel, they route around it, and
          you never hear about it as a color problem.
        </P>

        <H2>What I built, and where it loses</H2>
        <P>
          I wrote a solver that treats the background as an input instead of an assumption. Give it
          an N, a posture, a background, and your gridline color, and it returns a palette audited
          against contrast, CVD, and grayscale before you ship it.
        </P>
        <P>
          At N=6 on white it reaches {facts.solved6Worst.toFixed(2)}:1 worst contrast with zero
          failing slots, and a worst-case CVD ΔE of {facts.solved6Cvd.toFixed(1)}. Both beat all
          five published palettes at that N. Its minimum pairwise ΔE of{" "}
          {facts.solved6Pair.toFixed(1)} beats four of them and loses to IBM Carbon, which spreads
          its hues further than my solver does.
        </P>
        <P>
          Above six slots it stops winning. Worst contrast holds, but pairwise separation drops well
          under Tableau 10's. The solver buys contrast compliance with hue spread, and the price
          gets steep.
        </P>
        <P>
          That is the same wall as everyone else's. I did not solve it. What the tool does is tell
          you when you have hit it, and pair every slot with a dash, a decal, and a shape so the
          chart survives the moment color gives out.
        </P>

        <H2>Reproduce this</H2>
        <P>The engine is MIT.</P>
        {/* No scroll and no wrap: every line is short enough to fit a 375px
            viewport, so the reader never drags sideways and never sees a
            continuation line land left of its own indentation. pre-wrap stays
            on as a safety net for large text zoom, where breaking beats
            hiding. */}
        <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg border border-chart-grid bg-chart-surface p-4 text-[12.5px] leading-relaxed">
          <code>{`npm i chart-color-system culori`}</code>
        </pre>
        <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-chart-grid bg-chart-surface p-4 text-[12.5px] leading-relaxed">
          <code>{`import { fromCss, contrastRatio }
  from "chart-color-system";

const bg = fromCss("#ffffff");

// ColorBrewer Set2, worst slot
const c = fromCss("#FFD92F");

contrastRatio(c, bg);  // 1.38`}</code>
        </pre>
        <P>
          Every number on this page is computed in your browser by that package, against the
          palettes' published hexes. Nothing here is transcribed, so the post cannot drift from the
          solver.
        </P>
        <P>
          If you would rather move a slider than call a function,{" "}
          <Link to="/" className="text-primary underline underline-offset-2">
            the builder
          </Link>{" "}
          runs the same solver and audit, with CVD simulation and a grayscale check on every palette
          it produces.
        </P>
        <P>Run it against your own background before you argue with the tables. That is the point.</P>

        <p className="mt-8 border-t border-chart-grid pt-4 text-[11px] text-chart-muted-text">
          Pass and fail on this page are marked by a filled or hollow square and a word, never by
          hue alone.
        </p>
      </Prose>
    </article>
  );
}

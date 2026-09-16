/**
 * The Figma plugin, on the page that proves why it exists.
 *
 * Deliberately a dark block in a light page: it should read as the product,
 * not as another documentation card. The ground and the mark are the plugin's
 * own, and the strip is the visitor's current palette as other people receive
 * it, drawn with the dash and marker each slot carries. The last row is the
 * argument.
 *
 * Each row is ONE svg scaled uniformly. Per-slot svgs stretched to fill a flex
 * track turned every circle into an ellipse and every square into a rectangle,
 * which misrepresents the encodings this block is selling.
 *
 * Every colour here is audited in promoTokens.test.ts.
 */
import { simulateColor, type VisionMode } from "@/charts/audit";
import { dashScale, markerPathD } from "@/charts/encoding";
import type { ChartTheme } from "@/charts/echartsTheme";
import type { ColorRecord } from "@/charts/palette/distance";
import { PROMO } from "./promoTokens";

const BUY_URL = "https://buy.stripe.com/fZu00jedrdoY9zrgWTfAc00";

const ROWS: Array<{ mode: VisionMode; label: string; note: string }> = [
  { mode: "normal", label: "Normal", note: "what you see" },
  { mode: "deutan", label: "Deutan", note: "~6% of men" },
  { mode: "achromatopsia", label: "Greyscale", note: "print, projector" },
];

const FEATURES: Array<[string, string]> = [
  ["Write variables", "A solved palette into your file as Light and Dark variables, scoped and code-synced."],
  ["Audit a selection", "Contrast and CVD on colours already in your file, against the layers behind them."],
  ["Simulate on canvas", "Copies of your selection as other people receive them."],
  ["Dev Mode codegen", "Your developer selects the frame and gets the ECharts option or CSS tokens."],
];


/**
 * The viewBox is a FIXED size and the slots divide it, so the svg scales
 * uniformly (no squashed markers) and every row keeps the same height
 * whatever N is. Sizing the viewBox as n * slotWidth instead made a
 * two-series strip scale up to half again its intended height.
 */
const STRIP_W = 348;
const ROW_H = 26;

function VisionStrip({
  palette,
  mode,
  surface,
}: {
  palette: readonly ColorRecord[];
  mode: VisionMode;
  surface: string;
}) {
  const slotW = STRIP_W / palette.length;
  const inset = Math.min(6, slotW * 0.12);
  return (
    <svg
      viewBox={`0 0 ${STRIP_W} ${ROW_H}`}
      width="100%"
      className="block h-auto w-full rounded"
      aria-hidden
      focusable="false"
    >
      {/* The strip's fill is the visitor's own chart surface, which in dark
          themes is close to this panel's. The hairline keeps it a strip
          rather than a hole. */}
      <rect
        width={STRIP_W}
        height={ROW_H}
        fill={surface}
        rx="3"
        stroke={PROMO.hairline.hex}
        strokeWidth="0.75"
      />
      {palette.map((c, i) => {
        const colour = simulateColor(c, mode).hex;
        const dash = dashScale[i % dashScale.length];
        const x0 = i * slotW;
        const y = ROW_H / 2;
        return (
          <g key={i}>
            <line
              x1={x0 + inset}
              y1={y}
              x2={x0 + slotW - inset}
              y2={y}
              stroke={colour}
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeDasharray={dash === "solid" ? undefined : dash.join(" ")}
            />
            <path d={markerPathD(i, x0 + slotW / 2, y, 3.6)} fill={colour} />
          </g>
        );
      })}
    </svg>
  );
}

export function PluginPromo({ theme }: { theme: ChartTheme }) {
  const palette = theme.solve.palette.slice(0, 6);
  if (palette.length === 0) return null;
  const surface = theme.tokens.bg.hex;

  return (
    // overflow-clip, not the usual hidden: hidden makes this a scroll
    // container, and anything that scrolls a descendant into view (a keyboard
    // focus, an anchor jump) then slides the whole block sideways under the
    // clip. clip cannot scroll. Pinned in pluginPromo.test.ts.
    <div className="relative overflow-clip rounded-xl" style={{ background: PROMO.ground.hex }}>
      {/* The mark's own glow, so the block has depth rather than being a slab.
          Kept strictly inside the box - a negative offset would add scrollable
          overflow even while clipped. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[34rem] max-w-full"
        style={{
          background:
            "radial-gradient(58% 62% at 82% 6%, rgba(242,13,223,0.30), rgba(242,13,223,0.10) 45%, transparent 72%)",
        }}
      />

      <div className="relative p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <img
            src={`${import.meta.env.BASE_URL}plugin-icon.png`}
            alt=""
            width={48}
            height={48}
            className="rounded-xl"
          />
          <div className="min-w-0">
            <p
              className="m-0 text-[10px] font-medium uppercase tracking-[0.16em]"
              style={{ color: PROMO.quiet.hex }}
            >
              Figma plugin
            </p>
            <h3
              className="m-0 text-[22px] font-semibold leading-tight tracking-tight"
              style={{ color: PROMO.heading.hex }}
            >
              Chart Color System
            </h3>
          </div>
        </div>

        <p
          className="mt-5 max-w-[58ch] text-[15px] leading-relaxed"
          style={{ color: PROMO.body.hex }}
        >
          The same engine, inside the tool where the decision gets made. It solves against the
          background your chart actually sits on, and it will not hand you a number it cannot
          defend.
        </p>

        <div className="mt-7 grid gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <dl className="m-0 grid content-start gap-x-8 gap-y-6 sm:grid-cols-2">
            {FEATURES.map(([title, detail]) => (
              <div key={title}>
                <dt className="text-[13px] font-semibold" style={{ color: PROMO.heading.hex }}>
                  {title}
                </dt>
                <dd className="m-0 mt-1 text-[12.5px] leading-snug" style={{ color: PROMO.quiet.hex }}>
                  {detail}
                </dd>
              </div>
            ))}
          </dl>

          <figure
            className="m-0 rounded-lg border p-4"
            style={{ background: PROMO.raised.hex, borderColor: PROMO.hairline.hex }}
          >
            <figcaption
              className="mb-3 flex items-baseline justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.13em]"
              style={{ color: PROMO.quiet.hex }}
            >
              {/* Short enough not to wrap at phone width, where the count
                  otherwise landed mid-phrase and read as part of it. */}
              <span>As others receive it</span>
              <span className="whitespace-nowrap tabular-nums">{palette.length} slots</span>
            </figcaption>

            <div className="space-y-3">
              {ROWS.map((row) => (
                <div key={row.mode}>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="text-[11px] font-medium" style={{ color: PROMO.body.hex }}>
                      {row.label}
                    </span>
                    <span className="text-[10px]" style={{ color: PROMO.quiet.hex }}>
                      {row.note}
                    </span>
                  </div>
                  <VisionStrip palette={palette} mode={row.mode} surface={surface} />
                </div>
              ))}
            </div>

            <p className="m-0 mt-3.5 text-[11.5px] leading-snug" style={{ color: PROMO.quiet.hex }}>
              Colour is gone in the last row. Dash and marker are not.
            </p>
          </figure>
        </div>

        <div
          className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-6"
          style={{ borderColor: PROMO.hairline.hex }}
        >
          <a
            href={BUY_URL}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: PROMO.accent.hex, color: PROMO.onAccent.hex }}
          >
            Get the plugin
          </a>
          <span className="text-sm" style={{ color: PROMO.heading.hex }}>
            <span className="font-semibold tabular-nums">$79</span>{" "}
            <span className="font-normal" style={{ color: PROMO.quiet.hex }}>
              one-time, up to 5 seats
            </span>
          </span>
          <span
            className="basis-full text-[11.5px] lg:ml-auto lg:basis-auto lg:text-right"
            style={{ color: PROMO.quiet.hex }}
          >
            Declares no network access, so it cannot transmit your file.
          </span>
        </div>
      </div>
    </div>
  );
}

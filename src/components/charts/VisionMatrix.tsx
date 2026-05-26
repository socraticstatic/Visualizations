/**
 * Vision Matrix — render the current chart five times side-by-side under
 * normal / deutan / protan / tritan / achromatopsia, so designers can scan
 * for legibility regressions without flipping a toggle.
 *
 * Filters are the same SVG defs already mounted by <VisionFilters /> on
 * ChartsDemo. The matrix is a pure presentation wrapper.
 */
import { EChart } from "./EChart";

type Mode = "normal" | "deutan" | "protan" | "tritan" | "achromatopsia";

const MODES: Array<{ id: Mode; label: string; sub: string; filter: string }> = [
  { id: "normal", label: "Normal", sub: "trichromatic", filter: "none" },
  { id: "deutan", label: "Deuteranopia", sub: "~6% of men", filter: "url(#cvd-deutan)" },
  { id: "protan", label: "Protanopia", sub: "~2% of men", filter: "url(#cvd-protan)" },
  { id: "tritan", label: "Tritanopia", sub: "rare, ~0.01%", filter: "url(#cvd-tritan)" },
  { id: "achromatopsia", label: "Grayscale", sub: "print / projector", filter: "grayscale(1)" },
];

interface Props {
  option: Record<string, unknown>;
  /** Per-tile height in px. Width auto-fills the 5-up grid. */
  height?: number;
}

export function VisionMatrix({ option, height = 180 }: Props) {
  return (
    <section className="rounded-lg border border-chart-grid bg-chart-surface p-4 space-y-3">
      <header>
        <h2 className="text-sm font-medium uppercase tracking-wide text-chart-axis">
          Vision matrix
        </h2>
        <p className="text-[11px] text-chart-axis mt-0.5">
          The same chart simulated under five vision conditions. Scan for series that collapse
          into each other; dash / decal / shape should still differentiate them.
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {MODES.map((m) => (
          <div
            key={m.id}
            className="rounded border border-chart-grid bg-chart-bg overflow-hidden"
          >
            <div className="flex items-baseline justify-between px-2 py-1 border-b border-chart-grid">
              <span className="text-[11px] font-medium text-foreground">{m.label}</span>
              <span className="text-[10px] text-chart-axis">{m.sub}</span>
            </div>
            <div style={{ filter: m.filter }}>
              <EChart option={option} height={height} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

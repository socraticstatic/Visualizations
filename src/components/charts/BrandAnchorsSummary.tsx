/**
 * Brand anchors summary — shows which categorical slots are locked to brand
 * colors and how each anchor scores against the live background.
 *
 * Anchors come from `--chart-cat-anchor-1/2/3` and are passed verbatim into
 * `solveCategorical` as `locks` (in slot order). They are inserted into the
 * palette as-is — the solver does NOT nudge anchors, it only fills the
 * remaining slots. So the only failure mode is an anchor that itself
 * misses contrast against the background.
 */
import type { ChartTheme } from "@/charts/echartsTheme";
import { deltaE } from "@/charts/palette/distance";
import { contrastRatio } from "@/charts/audit";
import { THRESHOLDS } from "@/charts/constraints";

interface Props {
  theme: ChartTheme;
  /** Called when the user clicks "Edit anchors" — typically scrolls/opens the ColorPicker. */
  onEdit?: () => void;
}

export function BrandAnchorsSummary({ theme, onEdit }: Props) {
  const anchors = theme.tokens.anchors;
  const lockedCount = Math.min(anchors.length, theme.effectiveN);
  const bg = theme.tokens.bg;

  return (
    <section className="panel p-4 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-chart-axis">
            Brand anchors
          </h2>
          <p className="text-[11px] text-chart-axis mt-0.5">
            Anchors lock the first {lockedCount} slot{lockedCount === 1 ? "" : "s"} of the
            categorical palette. The solver fills the rest and never moves an anchor.
          </p>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs px-2 py-1 rounded border border-chart-grid bg-chart-bg text-foreground hover:bg-chart-grid/30"
          >
            Edit anchors
          </button>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-chart-axis">
              <th className="py-1 pr-4 font-medium">Slot</th>
              <th className="py-1 pr-4 font-medium">Anchor</th>
              <th className="py-1 pr-4 font-medium">Hex</th>
              <th className="py-1 pr-4 font-medium">ΔE vs. bg</th>
              <th className="py-1 pr-4 font-medium">Contrast vs. bg</th>
              <th className="py-1 pr-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {anchors.map((a, i) => {
              const used = i < theme.effectiveN;
              const de = deltaE(a, bg);
              const cr = contrastRatio(a, bg);
              const safeDe = de >= THRESHOLDS.minDeltaEvsBackground;
              const safeCr = cr >= 3;
              const status = !used
                ? "Unused (N too low)"
                : safeDe && safeCr
                ? "Locked · safe"
                : !safeDe && !safeCr
                ? "Locked · low ΔE + low contrast"
                : !safeDe
                ? "Locked · low ΔE vs. bg"
                : "Locked · low contrast";
              const statusClass = !used
                ? "text-chart-axis"
                : safeDe && safeCr
                ? "text-chart-positive"
                : "text-chart-warn";
              return (
                <tr key={i} className="border-t border-chart-grid/50">
                  <td className="py-1 pr-4 tabular-nums text-chart-axis">{i + 1}</td>
                  <td className="py-1 pr-4">
                    <span
                      className="inline-block h-4 w-6 rounded border border-chart-grid align-middle"
                      style={{ backgroundColor: a.hex }}
                      aria-hidden
                    />
                  </td>
                  <td className="py-1 pr-4 font-mono text-[11px] text-foreground/80">
                    {a.hex.toUpperCase()}
                  </td>
                  <td className="py-1 pr-4 tabular-nums">{de.toFixed(1)}</td>
                  <td className="py-1 pr-4 tabular-nums">{cr.toFixed(2)}:1</td>
                  <td className={`py-1 pr-4 ${statusClass}`}>{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-chart-axis">
        Need brand fidelity? Set anchors in the ColorPicker below — they ship verbatim into the
        exported CSS / Tailwind / ECharts theme.
      </p>
    </section>
  );
}

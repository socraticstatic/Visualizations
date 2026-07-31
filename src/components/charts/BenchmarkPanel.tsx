/**
 * Side-by-side comparison of the current solver palette vs. published systems
 * (Tableau, IBM Carbon, ColorBrewer, Material, Observable 10) measured
 * with the same math against the user's current chart background.
 *
 * Helps designers defend the solver's output — or pick a published system if
 * it scores better at the current N.
 */
import { useMemo } from "react";
import type { ColorRecord } from "@/charts/palette/distance";
import { scoreBenchmarks, scoreColors } from "@/charts/benchmarks";

interface Props {
  ours: ColorRecord[];
  background: ColorRecord;
}

export function BenchmarkPanel({ ours, background }: Props) {
  const rows = useMemo(() => {
    const n = ours.length;
    if (n < 2) return [];
    const oursScore = { id: "ours", name: "This solver", source: "current palette", ...scoreColors(ours, background) };
    const bench = scoreBenchmarks(n, background);
    return [oursScore, ...bench];
  }, [ours, background]);

  if (ours.length < 2) {
    return (
      <details className="rounded border border-chart-grid p-3 text-xs">
        <summary className="cursor-pointer text-chart-axis font-medium">Benchmark vs. published systems</summary>
        <div className="mt-2 text-chart-axis">
          Need N ≥ 2 to compare against Tableau, Carbon, ColorBrewer, Material, and Observable 10.
        </div>
      </details>
    );
  }

  const cell = (pass: boolean) => (pass ? "text-chart-positive-text" : "text-chart-negative-text font-medium");
  const best = (key: "minDeltaE" | "worstCvdDeltaE" | "worstContrast") =>
    Math.max(...rows.map((r) => r[key]));

  return (
    <details className="panel p-4 text-xs" open>
      <summary className="cursor-pointer text-sm font-medium text-chart-axis">
        Benchmark vs. published systems
        <span className="ml-2 text-[11px] opacity-70 font-normal">
          Same math, same background, N={ours.length}
        </span>
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <thead className="text-chart-axis">
            <tr className="border-b border-chart-grid">
              <th className="py-1 pr-2">Palette</th>
              <th className="py-1 pr-2">Swatches</th>
              <th className="py-1 pr-2">min ΔE</th>
              <th className="py-1 pr-2">worst CVD ΔE</th>
              <th className="py-1 pr-2">worst contrast</th>
              <th className="py-1 pr-2">Verdict</th>
            </tr>
            <tr className="text-[10px] text-chart-axis">
              <th></th>
              <th></th>
              <th>higher = more distinct</th>
              <th>worst of 3 simulations</th>
              <th>needs ≥ 3:1</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const allPass = r.passNormal && r.passCvd && r.passContrast;
              const winsNormal = r.minDeltaE >= best("minDeltaE") - 0.05;
              const winsCvd = r.worstCvdDeltaE >= best("worstCvdDeltaE") - 0.05;
              return (
                <tr key={r.id} className="border-b border-chart-grid/40">
                  <td className="py-1 pr-2 text-foreground">
                    {r.name}
                    <div className="text-[10px] text-chart-axis">{r.source}</div>
                  </td>
                  <td className="py-1 pr-2">
                    {/* Wraps. A non-wrapping row of N 16px chips gave this cell
                        a ~216px min-content width at N=12, which the table
                        could not shrink past -- making this the one panel in
                        the app that grew a horizontal scrollbar, and only at
                        some combinations of N and container width. */}
                    <div className="flex max-w-[7.5rem] flex-wrap gap-0.5">
                      {r.colors.map((c, i) => (
                        <span
                          key={i}
                          className="inline-block w-4 h-4 rounded-sm border border-chart-grid"
                          style={{ backgroundColor: c.hex }}
                          title={c.hex}
                        />
                      ))}
                    </div>
                  </td>
                  <td className={`py-1 pr-2 ${cell(r.passNormal)}`}>
                    {r.minDeltaE.toFixed(1)} {winsNormal && <span className="text-chart-axis">★</span>}
                  </td>
                  <td className={`py-1 pr-2 ${cell(r.passCvd)}`}>
                    {r.worstCvdDeltaE.toFixed(1)}{" "}
                    <span className="text-[10px] text-chart-axis">({r.cvdMode})</span>{" "}
                    {winsCvd && <span className="text-chart-axis">★</span>}
                  </td>
                  <td className={`py-1 pr-2 ${cell(r.passContrast)}`}>{r.worstContrast.toFixed(2)}:1</td>
                  <td className="py-1 pr-2">
                    {allPass ? (
                      <span className="text-chart-positive-text">✓ pass</span>
                    ) : (
                      <span className="text-chart-negative-text">✗ fails</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-chart-axis">
        ★ marks the best score in the column. Published systems are evaluated against your current
        chart background — so the same palette may pass on one theme and fail on another.
      </div>
    </details>
  );
}

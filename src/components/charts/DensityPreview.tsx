/**
 * Density preview — render each categorical slot at realistic chart-element
 * sizes (2px line, 4px bar, 8px scatter dot, sparkline, 11px legend swatch)
 * against the active background. Reveals which slots disappear at small sizes
 * before the user ships them.
 */
import type { ChartTheme } from "@/charts/echartsTheme";

interface Props {
  theme: ChartTheme;
}

export function DensityPreview({ theme }: Props) {
  const bg = theme.tokens.bg.hex;
  const colors = theme.colorHexes;
  if (colors.length === 0) return null;

  // Synthetic sparkline data, deterministic so the preview is stable across renders.
  const points = (seed: number) =>
    Array.from({ length: 18 }, (_, j) => 14 - 10 * Math.sin((j + seed) / 3) - (j % 3 === 0 ? 2 : 0));

  return (
    <details className="rounded-lg border border-chart-grid bg-chart-surface p-4 text-xs" open>
      <summary className="cursor-pointer text-sm font-medium text-chart-axis">
        Density preview — realistic sizes
        <span className="ml-2 text-[11px] opacity-70 font-normal">
          Every slot at 2px line · 4px bar · 8px dot · 11px legend
        </span>
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full tabular-nums">
          <thead className="text-chart-axis">
            <tr className="border-b border-chart-grid text-left">
              <th className="py-1 pr-2 w-10">#</th>
              <th className="py-1 pr-2">Legend (11px)</th>
              <th className="py-1 pr-2">Line (2px)</th>
              <th className="py-1 pr-2">Bar (4px)</th>
              <th className="py-1 pr-2">Dot (8px)</th>
              <th className="py-1 pr-2">Sparkline</th>
              <th className="py-1 pr-2">Hex</th>
            </tr>
          </thead>
          <tbody>
            {colors.map((c, i) => {
              const ys = points(i * 7);
              const path = ys
                .map((y, j) => `${j === 0 ? "M" : "L"} ${j * 8} ${y}`)
                .join(" ");
              return (
                <tr key={i} className="border-b border-chart-grid/40">
                  <td className="py-1 pr-2 text-chart-axis">{i}</td>
                  <td className="py-1 pr-2">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block"
                        style={{ width: 11, height: 11, backgroundColor: c, borderRadius: 2 }}
                      />
                      <span className="text-foreground text-[11px]">Series {i + 1}</span>
                    </span>
                  </td>
                  <td className="py-1 pr-2">
                    <svg width="120" height="14" style={{ background: bg }}>
                      <line x1="2" y1="7" x2="118" y2="7" stroke={c} strokeWidth="2" />
                    </svg>
                  </td>
                  <td className="py-1 pr-2">
                    <svg width="120" height="14" style={{ background: bg }}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <rect key={j} x={j * 12 + 2} y={3} width={4} height={8} fill={c} />
                      ))}
                    </svg>
                  </td>
                  <td className="py-1 pr-2">
                    <svg width="120" height="14" style={{ background: bg }}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <circle key={j} cx={10 + j * 20} cy={7} r={4} fill={c} />
                      ))}
                    </svg>
                  </td>
                  <td className="py-1 pr-2">
                    <svg width="148" height="20" style={{ background: bg }}>
                      <path d={path} stroke={c} strokeWidth="1.5" fill="none" />
                    </svg>
                  </td>
                  <td className="py-1 pr-2 text-chart-axis text-[10px]">{c.toUpperCase()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-chart-axis">
        If a slot vanishes at 2px line or 4px bar, lower N or push the solver toward higher contrast
        by locking a brand anchor on that slot.
      </div>
    </details>
  );
}

/**
 * Semantic role audit.
 *
 * The categorical solver enforces ΔE floors between *categorical* slots, but
 * semantic tokens (positive, negative, warn, info, target, forecast) are
 * shipped as fixed brand colors. Two common silent failures:
 *
 *   1. A semantic color is too close to the chart background (low contrast).
 *   2. A semantic color collides with a categorical slot under normal vision
 *      OR under deutan/protan/tritan — so a "good" green KPI bar blends into
 *      one of the categorical series in a stacked chart, or a positive
 *      arrow vanishes for colorblind viewers.
 *
 * This panel surfaces both, per semantic role, against the user's *current*
 * background and current categorical palette.
 */
import { useMemo } from "react";
import type { ChartTheme } from "@/charts/echartsTheme";
import type { ColorRecord } from "@/charts/palette/distance";
import { deltaE, cvdDeltaE } from "@/charts/palette/distance";
import { contrastRatio } from "@/charts/audit";
import { THRESHOLDS } from "@/charts/constraints";

interface Row {
  role: string;
  color: ColorRecord;
  contrast: number;
  contrastPass: boolean;
  worstSlot: number;
  worstDeltaE: number;
  worstCvdSlot: number;
  worstCvdDeltaE: number;
  pass: "ok" | "warn" | "fail";
  reason?: string;
}

export interface SemanticRoleAuditProps {
  theme: ChartTheme;
}

const MIN_CONTRAST = 3; // WCAG 2.2 SC 1.4.11 for non-text UI components.
const MIN_COLLISION_DE = THRESHOLDS.minDeltaENormal;
const MIN_COLLISION_CVD = THRESHOLDS.minDeltaECvd;

export function SemanticRoleAudit({ theme }: SemanticRoleAuditProps) {
  const rows = useMemo<Row[]>(() => {
    const t = theme.tokens;
    const bg = t.bg;
    const palette = theme.solve.palette;
    const roles: Array<{ role: string; color: ColorRecord }> = [
      { role: "positive", color: t.positive },
      { role: "negative", color: t.negative },
      { role: "target", color: t.target },
      { role: "forecast", color: t.forecast },
      { role: "muted", color: t.muted },
      { role: "other", color: t.other },
    ];

    return roles.map(({ role, color }) => {
      const contrast = contrastRatio(color, bg);
      const contrastPass = contrast >= MIN_CONTRAST;
      let worstSlot = -1;
      let worstDeltaE = Infinity;
      let worstCvdSlot = -1;
      let worstCvdDeltaE = Infinity;
      palette.forEach((p, idx) => {
        const d = deltaE(color, p);
        if (d < worstDeltaE) {
          worstDeltaE = d;
          worstSlot = idx;
        }
        const dc = cvdDeltaE(color, p);
        if (dc < worstCvdDeltaE) {
          worstCvdDeltaE = dc;
          worstCvdSlot = idx;
        }
      });

      let pass: Row["pass"] = "ok";
      let reason: string | undefined;
      if (!contrastPass) {
        pass = "fail";
        reason = `Contrast ${contrast.toFixed(2)}:1 vs. background (need ≥ ${MIN_CONTRAST}).`;
      } else if (worstDeltaE < MIN_COLLISION_DE) {
        pass = "fail";
        reason = `Collides with categorical slot #${worstSlot + 1} (ΔE ${worstDeltaE.toFixed(1)} < ${MIN_COLLISION_DE}).`;
      } else if (worstCvdDeltaE < MIN_COLLISION_CVD) {
        pass = "warn";
        reason = `Under CVD, collides with slot #${worstCvdSlot + 1} (ΔE ${worstCvdDeltaE.toFixed(1)} < ${MIN_COLLISION_CVD}).`;
      }

      return {
        role,
        color,
        contrast,
        contrastPass,
        worstSlot,
        worstDeltaE,
        worstCvdSlot,
        worstCvdDeltaE,
        pass,
        reason,
      };
    });
  }, [theme]);

  const fails = rows.filter((r) => r.pass === "fail").length;
  const warns = rows.filter((r) => r.pass === "warn").length;

  return (
    <section className="rounded-md border border-chart-grid bg-chart-bg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-wide text-chart-axis">
          Semantic role audit
        </h3>
        <div className="text-[11px] text-chart-axis">
          {fails === 0 && warns === 0 ? (
            <span className="text-chart-positive">All roles safe</span>
          ) : (
            <>
              {fails > 0 && <span className="text-chart-negative">{fails} fail</span>}
              {fails > 0 && warns > 0 && <span> · </span>}
              {warns > 0 && <span className="text-chart-warn">{warns} warn</span>}
            </>
          )}
        </div>
      </div>
      <p className="text-[11px] text-chart-axis">
        Checks each semantic token (positive · negative · target · forecast · muted · other)
        for WCAG ≥ 3:1 contrast vs. the chart background <em>and</em> for collisions with
        the current categorical palette under normal + CVD vision.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-chart-axis">
              <th className="text-left font-normal pr-2">Role</th>
              <th className="text-left font-normal pr-2">Swatch</th>
              <th className="text-left font-normal pr-2">Hex</th>
              <th className="text-left font-normal pr-2">Contrast vs. bg</th>
              <th className="text-left font-normal pr-2">Nearest slot (ΔE)</th>
              <th className="text-left font-normal pr-2">Nearest slot under CVD (ΔE)</th>
              <th className="text-left font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.role} className="border-t border-chart-grid/50">
                <td className="py-1 pr-2 capitalize text-foreground">{r.role}</td>
                <td className="py-1 pr-2">
                  <span
                    className="inline-block h-4 w-8 rounded border border-chart-grid"
                    style={{ background: r.color.hex }}
                  />
                </td>
                <td className="py-1 pr-2 tabular-nums text-foreground/80">{r.color.hex.toUpperCase()}</td>
                <td className={`py-1 pr-2 tabular-nums ${r.contrastPass ? "text-chart-positive" : "text-chart-negative"}`}>
                  {r.contrast.toFixed(2)}:1
                </td>
                <td className="py-1 pr-2 tabular-nums text-foreground/80">
                  #{r.worstSlot + 1} · {r.worstDeltaE.toFixed(1)}
                </td>
                <td className="py-1 pr-2 tabular-nums text-foreground/80">
                  #{r.worstCvdSlot + 1} · {r.worstCvdDeltaE.toFixed(1)}
                </td>
                <td
                  className={`py-1 ${
                    r.pass === "ok"
                      ? "text-chart-positive"
                      : r.pass === "warn"
                      ? "text-chart-warn"
                      : "text-chart-negative"
                  }`}
                  title={r.reason}
                >
                  {r.pass === "ok"
                    ? "✓ safe"
                    : r.pass === "warn"
                    ? "⚠ CVD risk"
                    : r.contrastPass
                    ? `✗ collides with #${r.worstSlot + 1}`
                    : "✗ low contrast"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

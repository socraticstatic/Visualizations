import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { BEST_PRACTICE } from "@/charts/bestPractices";
import type { ChartKind } from "@/charts/chartKinds";
import { deltaE, cvdDeltaE, type ColorRecord } from "@/charts/palette/distance";
import { contrastRatio } from "@/charts/audit";
import { THRESHOLDS, CVD_SEVERITY } from "@/charts/constraints";
import { safeMaxN } from "@/charts/builtinBounds";
import { getChartTheme, type Theme } from "@/charts/echartsTheme";
import { CHART_KIND_LABEL } from "@/charts/chartKinds";

/**
 * AutoAuditSummary — runs an accessibility/contrast/ΔE/CVD sweep across
 * every N reachable from the built-in slider for the current (kind, theme),
 * automatically on every render of the default builder state.
 *
 * Surfaces a compact summary:
 *  - All-pass: green "{N} permutations · all optimal" pill.
 *  - Any failure: red card listing the failing N values + the first reason.
 *
 * Gated on `hasManualOverrides` — when the user has edited tokens via
 * ColorPicker the dedicated Verify stage takes over and this auto-sweep
 * stays quiet (it only audits the *built-in* slot of palettes).
 *
 * Cheap: the inner solver is the same one the live chart already runs,
 * memoized on (kind, theme), so this typically adds <30 ms per render.
 */
export interface AutoAuditSummaryProps {
  kind: ChartKind;
  theme: Theme;
  hasManualOverrides: boolean;
  /** Anchor tokens read from the live chart theme (slot 0..2). */
  anchors: ColorRecord[];
  /** Background token from the live chart theme. */
  background: ColorRecord;
  /** Grid token from the live chart theme. */
  grid: ColorRecord;
  /** Variant B (optional, only in compare-normal mode). */
  variantB?: {
    kind: ChartKind;
    theme: Theme;
    anchors: ColorRecord[];
    background: ColorRecord;
    grid: ColorRecord;
  };
}

interface PermResult {
  n: number;
  ok: boolean;
  reason?: string;
}

function auditVariant(
  kind: ChartKind,
  theme: Theme
): { results: PermResult[]; cap: number; skipped: boolean } {
  const rule = BEST_PRACTICE[kind];
  if (rule.family !== "categorical") {
    return { results: [], cap: 0, skipped: true };
  }
  const cap = Math.min(rule.recommendedN, safeMaxN(theme, rule.posture));
  const results: PermResult[] = [];
  for (let n = 1; n <= cap; n++) {
    // Audit the exact palettes the builder renders: getChartTheme (cached,
    // locks: []). Re-solving here with anchor hard-locks audited palettes
    // the app never shows and contradicted the live harness.
    const t = getChartTheme(theme, rule.posture, n);
    const { palette, relaxations } = t.solve;
    const background = t.tokens.bg;
    let ok = relaxations.length === 0;
    let reason: string | undefined;
    if (!ok) reason = `solver relaxed ${String(relaxations[0] ?? "constraint")}`;
    if (ok && n >= 2) {
      outer: for (let i = 0; i < palette.length; i++) {
        if (contrastRatio(palette[i], background) < 3) {
          ok = false;
          reason = `slot ${i + 1} contrast < 3:1`;
          break;
        }
        for (let j = i + 1; j < palette.length; j++) {
          if (deltaE(palette[i], palette[j]) < THRESHOLDS.minDeltaENormal) {
            ok = false;
            reason = `slots ${i + 1}↔${j + 1} ΔE < ${THRESHOLDS.minDeltaENormal}`;
            break outer;
          }
          if (cvdDeltaE(palette[i], palette[j], CVD_SEVERITY) < THRESHOLDS.minDeltaECvd) {
            ok = false;
            reason = `slots ${i + 1}↔${j + 1} CVD-ΔE < ${THRESHOLDS.minDeltaECvd}`;
            break outer;
          }
        }
      }
    }
    results.push({ n, ok, reason });
  }
  return { results, cap, skipped: false };
}

export function AutoAuditSummary({
  kind,
  theme,
  hasManualOverrides,
  variantB,
}: AutoAuditSummaryProps) {
  const a = useMemo(() => auditVariant(kind, theme), [kind, theme]);
  const b = useMemo(
    () => (variantB ? auditVariant(variantB.kind, variantB.theme) : null),
    [variantB]
  );

  // When the user is editing tokens manually, the dedicated Verify stage
  // owns warnings — stay quiet here.
  if (hasManualOverrides) return null;

  const variants: Array<{ label: string; data: ReturnType<typeof auditVariant> }> = [
    { label: `A · ${CHART_KIND_LABEL[kind]}`, data: a },
  ];
  if (b && variantB) {
    variants.push({ label: `B · ${CHART_KIND_LABEL[variantB.kind]}`, data: b });
  }

  // Collect failures across variants.
  const failures = variants.flatMap((v) =>
    v.data.results
      .filter((r) => !r.ok)
      .map((r) => ({ variant: v.label, n: r.n, reason: r.reason ?? "unknown" }))
  );
  const totalChecked = variants.reduce((sum, v) => sum + v.data.results.length, 0);

  if (failures.length === 0) {
    // If every variant was skipped (diverging/sequential — no solver sweep),
    // report honestly instead of claiming vacuous "all optimal".
    if (totalChecked === 0) {
      return (
        <div
          className="flex items-center gap-2 rounded-md border border-chart-grid/50 bg-chart-grid/5 px-3 py-2 text-xs text-chart-axis"
          role="status"
        >
          <span>
            <strong className="font-semibold">Auto-audit:</strong> Ramp palette — solver sweep does
            not apply. WCAG contrast and ΔE details are in the Verify panel.
          </span>
        </div>
      );
    }
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-chart-positive/30 bg-chart-positive/5 px-3 py-2 text-xs text-chart-positive"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">Auto-audit:</strong> {totalChecked} reachable permutation
          {totalChecked === 1 ? "" : "s"} swept ·{" "}
          {variants
            .map((v) => `${v.label} N=1..${v.data.cap}`)
            .join(" · ")}{" "}
          · all optimal (ΔE, CVD, WCAG 3:1, zero relaxations).
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-chart-warn/40 bg-chart-warn/10 px-3 py-2 text-xs text-chart-warn"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">Auto-audit:</strong> {failures.length} of {totalChecked}{" "}
          reachable N value{totalChecked === 1 ? "" : "s"} needed a relaxation. Solver pass-rate is
          non-monotone in N — a higher N can satisfy every constraint while a smaller N inside the
          same range trips one. The slider still lets you pick these so the trade-off is visible;
          rows below show which constraint relaxed.
        </span>
      </div>
      <ul className="ml-6 list-disc space-y-0.5">
        {failures.slice(0, 6).map((f, i) => (
          <li key={i}>
            <span className="font-mono">{f.variant} · N={f.n}</span> — {f.reason}
          </li>
        ))}
        {failures.length > 6 && (
          <li className="opacity-80">…and {failures.length - 6} more</li>
        )}
      </ul>
    </div>
  );
}

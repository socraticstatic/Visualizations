import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { BEST_PRACTICE } from "@/charts/bestPractices";
import { CHART_KIND_LABEL, type ChartKind } from "@/charts/chartKinds";
import { deltaE, cvdDeltaE, type ColorRecord } from "@/charts/palette/distance";
import { contrastRatio } from "@/charts/audit";
import { THRESHOLDS, CVD_SEVERITY } from "@/charts/constraints";
import { safeMaxN } from "@/charts/builtinBounds";
import { getChartTheme, type Theme } from "@/charts/echartsTheme";

type ConstraintTag = "ΔE" | "CVD-ΔE" | "WCAG" | "solver";

interface Failure {
  tag: ConstraintTag;
  detail: string;
}

interface PermRow {
  theme: Theme;
  kind: ChartKind;
  n: number;
  ok: boolean;
  failures: Failure[];
}

/**
 * Audit ONE (theme, kind, N) permutation and collect every failing constraint
 * (not just the first). Returns `ok=true` with empty failures when the palette
 * is fully optimal.
 */
function auditPermutation(theme: Theme, kind: ChartKind, n: number): PermRow {
  const rule = BEST_PRACTICE[kind];
  // Audit the exact palettes the builder renders: getChartTheme (cached,
  // locks: []). Re-solving here with anchor hard-locks audited palettes the
  // app never shows, contradicted the live harness, and made the 374-row
  // sweep re-anneal from scratch instead of hitting the theme cache.
  const t = getChartTheme(theme, rule.posture, n);
  const bg: ColorRecord = t.tokens.bg;
  const { palette, relaxations } = t.solve;

  const failures: Failure[] = [];

  for (const r of relaxations) {
    failures.push({ tag: "solver", detail: `solver relaxed ${String(r)}` });
  }

  for (let i = 0; i < palette.length; i++) {
    const cr = contrastRatio(palette[i], bg);
    if (cr < 3) {
      failures.push({
        tag: "WCAG",
        detail: `slot ${i + 1} contrast ${cr.toFixed(2)}:1 < 3:1`,
      });
    }
    for (let j = i + 1; j < palette.length; j++) {
      const de = deltaE(palette[i], palette[j]);
      if (de < THRESHOLDS.minDeltaENormal) {
        failures.push({
          tag: "ΔE",
          detail: `slots ${i + 1}↔${j + 1} ΔE ${de.toFixed(2)} < floor ${THRESHOLDS.minDeltaENormal}`,
        });
      }
      const dec = cvdDeltaE(palette[i], palette[j], CVD_SEVERITY);
      if (dec < THRESHOLDS.minDeltaECvd) {
        failures.push({
          tag: "CVD-ΔE",
          detail: `slots ${i + 1}↔${j + 1} CVD-ΔE ${dec.toFixed(2)} < floor ${THRESHOLDS.minDeltaECvd}`,
        });
      }
    }
  }

  return { theme, kind, n, ok: failures.length === 0, failures };
}

const TAG_STYLES: Record<ConstraintTag, string> = {
  ΔE: "bg-chart-warn/15 text-chart-warn border-chart-warn/40",
  "CVD-ΔE": "bg-chart-target/15 text-chart-target border-chart-target/40",
  WCAG: "bg-destructive/15 text-destructive border-destructive/40",
  solver: "bg-chart-info/15 text-chart-info-text border-chart-info/40",
};

/**
 * FullPermutationAudit — exhaustively sweeps every (theme, kind, N)
 * permutation reachable from the built-in builder controls and surfaces a
 * detailed breakdown of which constraint(s) failed for each non-optimal row.
 *
 * Constraint tags shown: ΔE (perceptual distance for normal vision), CVD-ΔE
 * (worst-case across protanopia/deuteranopia/tritanopia), WCAG (3:1 contrast
 * vs background), solver (any relaxations the optimizer had to apply).
 *
 * Renders a compact summary row by default; expands to a per-permutation
 * table when there are failures or when the user toggles "Show all".
 *
 * Hidden when manual ColorPicker overrides are active — that case is owned
 * by the dedicated Verify stage.
 */
export type AuditScope = "kind" | "all";

export interface SystemAuditProps {
  hasManualOverrides: boolean;
  /** Current builder selection, used by the "This chart type" scope. */
  kind: ChartKind;
  theme: Theme;
}

export function SystemAudit({ hasManualOverrides, kind, theme }: SystemAuditProps) {
  const [expanded, setExpanded] = useState(false);
  /**
   * AutoAuditSummary used to sweep the ~12 permutations reachable for the
   * current (kind, theme) and render as its own panel directly above this one,
   * which swept all 374. The 12 are a strict subset of the 374, so two stacked
   * panels were reporting the same thing at two zoom levels. It is a filter.
   */
  const [scope, setScope] = useState<AuditScope>("kind");
  const [rows, setRows] = useState<PermRow[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [running, setRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const runIdRef = useRef(0);


  // Build the list of permutations to sweep.
  const buildPlan = useCallback(() => {
    const themes: Theme[] = ["light", "dark"];
    const kinds = (Object.keys(BEST_PRACTICE) as ChartKind[]).filter(
      (k) => BEST_PRACTICE[k].family === "categorical"
    );
    const plan: Array<{ theme: Theme; kind: ChartKind; n: number }> = [];
    for (const theme of themes) {
      for (const kind of kinds) {
        const rule = BEST_PRACTICE[kind];
        const cap = Math.min(rule.recommendedN, safeMaxN(theme, rule.posture));
        for (let n = 1; n <= cap; n++) plan.push({ theme, kind, n });
      }
    }
    if (scope === "kind") return plan.filter((p) => p.kind === kind && p.theme === theme);
    return plan;
  }, [scope, kind, theme]);

  const runAudit = useCallback(() => {
    const plan = buildPlan();
    const myRun = ++runIdRef.current;
    setRunning(true);
    setRows([]);
    setProgress({ done: 0, total: plan.length });

    const collected: PermRow[] = [];
    let i = 0;
    const CHUNK = 6; // keeps each tick under ~16 ms on a typical laptop

    const tick = () => {
      if (myRun !== runIdRef.current) return; // superseded by a newer run
      const end = Math.min(i + CHUNK, plan.length);
      for (; i < end; i++) {
        const { theme, kind, n } = plan[i];
        collected.push(auditPermutation(theme, kind, n));
      }
      setProgress({ done: i, total: plan.length });
      if (i < plan.length) {
        // Yield with setTimeout, NOT requestAnimationFrame: rAF never fires
        // in a hidden tab, which froze the sweep at the first chunk whenever
        // the user switched away mid-run. setTimeout still lets the progress
        // bar paint between chunks when the tab is visible.
        setTimeout(tick, 0);
      } else {
        setRows(collected);
        setRunning(false);
        setLastRunAt(Date.now());
      }
    };
    tick();
  }, [buildPlan]);

  // Auto-run once on mount (and whenever the manual-overrides gate flips off)
  // so the panel is populated without requiring a manual click.
  useEffect(() => {
    if (hasManualOverrides) {
      runIdRef.current++; // cancel any in-flight run
      setRows([]);
      setProgress({ done: 0, total: 0 });
      setRunning(false);
      return;
    }
    runAudit();
    // Re-running on scope/kind/theme keeps the rows and the label in step: a
    // stale set of rows under a new label reports a narrow pass as a broad one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasManualOverrides, scope, kind, theme]);

  if (hasManualOverrides) return null;

  const failingRows = rows.filter((r) => !r.ok);
  const totalChecked = rows.length;
  const anyFailures = failingRows.length > 0;
  // Auto-expand on failure so the user can see exactly which permutations broke.
  const isOpen = expanded || anyFailures;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section
      className="rounded-md border border-border bg-card/40 text-card-foreground"
      aria-label="Full permutation accessibility audit"
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
        <div role="radiogroup" aria-label="Audit scope" className="flex shrink-0 gap-1">
          {(
            [
              ["kind", "This chart type"],
              ["all", "Everything"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={scope === value}
              onClick={() => setScope(value)}
              className={[
                "tap-target rounded border px-2 py-1 text-xs transition-colors",
                scope === value
                  ? "border-chart-info-strong bg-chart-info-strong text-chart-bg"
                  : "border-chart-grid bg-chart-surface text-chart-muted-text hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={isOpen}
          aria-controls="full-permutation-audit-body"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin text-chart-info-text" aria-hidden />
          ) : anyFailures ? (
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
          ) : totalChecked > 0 ? (
            <CheckCircle2 className="h-4 w-4 text-chart-positive-text" aria-hidden />
          ) : (
            <PlayCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
          <strong className="font-semibold">
            {scope === "kind" ? "This chart type:" : "Full sweep:"}
          </strong>
          {running ? (
            <span className="text-chart-info-text">
              auditing… {progress.done}/{progress.total} ({pct}%)
            </span>
          ) : totalChecked === 0 ? (
            <span className="text-muted-foreground">not run yet</span>
          ) : (
            <span>
              {totalChecked}{" "}
              {scope === "kind"
                ? `${CHART_KIND_LABEL[kind]} · ${theme} theme`
                : "(theme × kind × N)"}{" "}
              permutation{totalChecked === 1 ? "" : "s"} ·{" "}
              {anyFailures ? (
                <span className="text-destructive">{failingRows.length} non-optimal</span>
              ) : (
                <span className="text-chart-positive-text">all optimal</span>
              )}
              {lastRunAt && (
                <span className="ml-2 text-muted-foreground">
                  · last run {new Date(lastRunAt).toLocaleTimeString()}
                </span>
              )}
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-80" aria-hidden />
          ) : (
            <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-80" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={runAudit}
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded border border-chart-info/40 bg-chart-info/10 px-2 py-1 text-xs font-medium text-chart-info-text hover:bg-chart-info/20 disabled:cursor-not-allowed disabled:opacity-80"
          title={
            scope === "kind"
              ? "Re-run the sweep for this chart kind and theme"
              : "Re-run the full (theme × kind × N) accessibility sweep"
          }
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <PlayCircle className="h-3.5 w-3.5" aria-hidden />
          )}
          {running ? "Running…" : "Run audit"}
        </button>
      </div>

      {/* Progress bar — only when running, sits between header and body. */}
      {running && (
        <div
          className="mx-3 mb-2 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          aria-label="Audit progress"
        >
          <div
            className="h-full bg-chart-info transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}


      {isOpen && totalChecked > 0 && (
        <div id="full-permutation-audit-body" className="border-t border-border px-3 py-2">
          {anyFailures ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                These are the specific (theme, kind, N) combinations where the solver could not
                clear every floor. This is expected: the solver's pass-rate is not monotone in N,
                so a value below the safe cap can miss a floor the cap itself clears. The default
                N snap avoids these; if you dial one in by hand, the audit badge beside the chart
                flags it live.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">Theme</th>
                      <th className="py-1 pr-3 font-medium">Kind</th>
                      <th className="py-1 pr-3 font-medium">N</th>
                      <th className="py-1 pr-3 font-medium">Failed</th>
                      <th className="py-1 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failingRows.map((r) => {
                      const tags = Array.from(new Set(r.failures.map((f) => f.tag)));
                      return (
                        <tr
                          key={`${r.theme}-${r.kind}-${r.n}`}
                          className="border-b border-border/50 align-top"
                        >
                          <td className="py-1 pr-3 font-mono">{r.theme}</td>
                          <td className="py-1 pr-3">{CHART_KIND_LABEL[r.kind]}</td>
                          <td className="py-1 pr-3 font-mono">{r.n}</td>
                          <td className="py-1 pr-3">
                            <span className="flex flex-wrap gap-1">
                              {tags.map((t) => (
                                <span
                                  key={t}
                                  className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] ${TAG_STYLES[t]}`}
                                >
                                  {t}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="py-1">
                            <ul className="space-y-0.5">
                              {r.failures.map((f, i) => (
                                <li key={i} className="text-muted-foreground">
                                  <span
                                    className={`mr-1 inline-flex rounded border px-1 font-mono text-[10px] ${TAG_STYLES[f.tag]}`}
                                  >
                                    {f.tag}
                                  </span>
                                  {f.detail}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Every (theme × kind × N) permutation reachable from the built-in controls
                passes ΔE, CVD-ΔE, and WCAG 3:1 with zero solver relaxations. Showing the
                full pass list for traceability.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">Theme</th>
                      <th className="py-1 pr-3 font-medium">Kind</th>
                      <th className="py-1 pr-3 font-medium">N range</th>
                      <th className="py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summarizeByThemeKind(rows).map((g) => (
                      <tr
                        key={`${g.theme}-${g.kind}`}
                        className="border-b border-border/50"
                      >
                        <td className="py-1 pr-3 font-mono">{g.theme}</td>
                        <td className="py-1 pr-3">{CHART_KIND_LABEL[g.kind]}</td>
                        <td className="py-1 pr-3 font-mono">
                          N={g.minN}..{g.maxN}
                        </td>
                        <td className="py-1 text-chart-positive-text">
                          all {g.maxN - g.minN + 1} optimal
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function summarizeByThemeKind(rows: PermRow[]) {
  const groups = new Map<string, { theme: Theme; kind: ChartKind; minN: number; maxN: number }>();
  for (const r of rows) {
    const key = `${r.theme}|${r.kind}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { theme: r.theme, kind: r.kind, minN: r.n, maxN: r.n });
    } else {
      g.minN = Math.min(g.minN, r.n);
      g.maxN = Math.max(g.maxN, r.n);
    }
  }
  return Array.from(groups.values());
}

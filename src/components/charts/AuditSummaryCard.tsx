import type { AuditReport } from "@/charts/audit";
import { THRESHOLDS } from "@/charts/constraints";

/** Human reading of a min pairwise ΔE — shown instead of the raw pass floor,
 *  which is deliberately minimal and reads as nonsense ("≥ 0.1") on its own. */
function deltaEWords(v: number): string {
  if (!Number.isFinite(v)) return "not applicable";
  if (v >= 10) return "clearly distinct";
  if (v >= 2) return "distinguishable";
  return "patterns carry identity";
}

type Warning = { severity: "error" | "warn" | "info"; title: string; detail: string };

type SolveInfo = {
  minPairDeltaE: number;
  minCvdDeltaE: number;
  relaxations: string[];
};

type Props = {
  audit: AuditReport;
  solve: SolveInfo;
  warnings: Warning[];
  n: number;
  requestedN: number;
  overflow: boolean;
  /**
   * True only when the user has manually overridden palette tokens via
   * ColorPicker. Built-in controls (kind/N/theme) are guaranteed correct
   * by the solver, so audit warnings should NOT surface in that mode —
   * see project memory rule on warnings scope.
   */
  hasManualOverrides: boolean;
  onJumpToVerify?: () => void;
};

export function AuditSummaryCard({
  audit,
  solve,
  warnings,
  n,
  requestedN,
  overflow,
  hasManualOverrides,
  onJumpToVerify,
}: Props) {
  const passNormal = solve.minPairDeltaE >= THRESHOLDS.minDeltaENormal;
  const passCvd = solve.minCvdDeltaE >= THRESHOLDS.minDeltaECvd;
  const passBg = audit.bgPass;
  const noRelax = solve.relaxations.length === 0;

  // In built-in mode the solver guarantees ΔE/CVD/relaxation constraints.
  // But WCAG background contrast is CSS-token-driven and must always be surfaced.
  const bgWarning = warnings.find((w) => w.title.toLowerCase().includes("contrast vs. background"));
  const effectiveWarnings = hasManualOverrides
    ? warnings
    : !passBg && bgWarning
    ? [bgWarning]
    : [];
  const errors = effectiveWarnings.filter((w) => w.severity === "error").length;
  const warns = effectiveWarnings.filter((w) => w.severity === "warn").length;
  const infos = effectiveWarnings.filter((w) => w.severity === "info").length;

  // In built-in mode the solver guarantees ΔE, CVD, and relaxation constraints for
  // categorical charts — but WCAG background contrast is CSS-token-driven and never
  // solver-guaranteed for diverging/sequential families. Always surface bgPass.
  const status: "pass" | "warn" | "fail" = !hasManualOverrides
    ? !passBg
      ? "fail"
      : "pass"
    : audit.overall === "fail" || errors > 0 || !passBg
    ? "fail"
    : audit.overall === "warn" || warns > 0 || !passNormal || !passCvd || !noRelax || overflow
    ? "warn"
    : "pass";

  const statusMeta = {
    pass: {
      label: hasManualOverrides
        ? "All checks pass"
        : "Built-in palette · constraints enforced by solver",
      tone: "text-chart-positive-text",
      bg: "bg-chart-positive/10 border-chart-positive/40",
      icon: "✓",
    },
    warn: {
      label: "Review recommended",
      tone: "text-chart-target",
      bg: "bg-chart-target/10 border-chart-target/40",
      icon: "!",
    },
    fail: {
      label: hasManualOverrides ? "Accessibility failure" : "WCAG contrast fails · ramp token needs adjustment",
      tone: "text-chart-negative-text",
      bg: "bg-chart-negative/10 border-chart-negative/40",
      icon: "✕",
    },
  }[status];

  const topIssue = hasManualOverrides
    ? effectiveWarnings.find((w) => w.severity === "error") ??
      effectiveWarnings.find((w) => w.severity === "warn") ??
      effectiveWarnings.find((w) => w.severity === "info")
    : undefined;


  return (
    <section
      aria-label="Palette audit summary"
      className={`rounded-lg border ${statusMeta.bg} p-4 space-y-3`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-current text-base font-bold ${statusMeta.tone}`}
            aria-hidden
          >
            {statusMeta.icon}
          </span>
          <div>
            <div className={`text-sm font-semibold ${statusMeta.tone}`}>
              {statusMeta.label}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-chart-axis">
              Palette audit · rendering N={n}
              {overflow && ` (capped from ${requestedN})`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Pill label="Errors" count={errors} tone={errors ? "neg" : "muted"} />
          <Pill label="Warnings" count={warns} tone={warns ? "warn" : "muted"} />
          <Pill label="Info" count={infos} tone="muted" />
          {onJumpToVerify && (
            <button
              type="button"
              onClick={onJumpToVerify}
              className="ml-1 inline-flex items-center gap-1 rounded-full border border-chart-grid bg-chart-bg px-2.5 py-1 text-chart-axis hover:text-foreground hover:border-chart-info transition-colors"
              title="Scroll to the Verify stage for full details"
            >
              Details →
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Stat
          label="WCAG contrast vs. bg"
          value={`${audit.worstContrastVsBg.toFixed(2)}:1`}
          ok={passBg}
          help="≥ 3:1 required (SC 1.4.11)"
        />
        <Stat
          label="min ΔE (normal vision)"
          value={solve.minPairDeltaE === Infinity ? "n/a" : solve.minPairDeltaE.toFixed(1)}
          ok={passNormal}
          help={deltaEWords(solve.minPairDeltaE)}
        />
        <Stat
          label="min ΔE (worst CVD)"
          value={solve.minCvdDeltaE === Infinity ? "n/a" : solve.minCvdDeltaE.toFixed(1)}
          ok={passCvd}
          help={deltaEWords(solve.minCvdDeltaE)}
        />
        <Stat
          label="Constraint relaxations"
          value={noRelax ? "none" : `${solve.relaxations.length}`}
          ok={noRelax}
          help={noRelax ? "all constraints satisfied" : solve.relaxations.join(", ")}
        />
      </div>

      {topIssue && (
        <div className="text-xs text-chart-axis border-t border-chart-grid/60 pt-2">
          <span className="font-medium text-foreground">Top issue: </span>
          <span className="text-foreground/90">{topIssue.title}</span>
          <span className="opacity-70"> — {topIssue.detail}</span>
        </div>
      )}
    </section>
  );
}

function Pill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "neg" | "warn" | "muted";
}) {
  const toneClass =
    tone === "neg"
      ? "border-chart-negative/50 text-chart-negative-text"
      : tone === "warn"
      ? "border-chart-target/50 text-chart-target"
      : "border-chart-grid text-chart-axis";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 tabular-nums ${toneClass}`}
    >
      <span className="font-medium">{count}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

function Stat({
  label,
  value,
  ok,
  help,
}: {
  label: string;
  value: string;
  ok: boolean;
  help: string;
}) {
  return (
    <div className="rounded border border-chart-grid bg-chart-bg/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-chart-axis">{label}</div>
      <div
        className={`tabular-nums text-sm font-medium ${
          ok ? "text-chart-positive-text" : "text-chart-negative-text"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] text-chart-axis">{help}</div>
    </div>
  );
}

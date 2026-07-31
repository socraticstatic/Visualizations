import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { EChart } from "@/components/charts/EChart";
import {
  buildBase,
  buildBarSeries,
  buildLineSeries,
  buildVisualMap,
  clearChartThemeCache,
  getChartTheme,
  type Theme,
} from "@/charts/echartsTheme";
import { THRESHOLDS, POSTURE, type Posture } from "@/charts/constraints";
import { PALETTE_VERSION } from "@/charts/version";
import { sequentialRamp, divergingRamp } from "@/charts/palette/ramps";
import { CHART_KIND_LABEL, type ChartKind } from "@/charts/chartKinds";
import { BEST_PRACTICE } from "@/charts/bestPractices";
import { auditPalette, contrastRatio, simulateColor, type AuditReport, type VisionMode } from "@/charts/audit";
import { deltaE, fromCss, type ColorRecord } from "@/charts/palette/distance";
import { exportComparisonReport } from "@/charts/exportReport";
import { ExportPalette } from "@/components/charts/ExportPalette";
import { CoachTour, useShouldAutoOpenTour } from "@/components/charts/CoachTour";
import { PalettePresets } from "@/components/charts/PalettePresets";
import { BenchmarkPanel } from "@/components/charts/BenchmarkPanel";
import { DensityPreview } from "@/components/charts/DensityPreview";
import { CodeSnippet } from "@/components/charts/CodeSnippet";
import { SemanticRoleAudit } from "@/components/charts/SemanticRoleAudit";
import { ShareLink, useUrlStateSync } from "@/components/charts/ShareLink";
import { VisionMatrix } from "@/components/charts/VisionMatrix";
import { LazyMount } from "@/components/charts/LazyMount";
import { EmphasisPreview } from "@/components/charts/EmphasisPreview";
import { InsightCallouts } from "@/components/charts/InsightCallouts";
import type { UrlState } from "@/charts/urlState";
import { buildPinPermutation, applyPinsToTheme } from "@/charts/entityPins";
import { EntityPins } from "@/components/charts/EntityPins";
import { toast } from "@/hooks/use-toast";
import { NextStageButton } from "@/components/charts/NextStageButton";
import { OptimalOnlyBadge } from "@/components/charts/OptimalOnlyBadge";
import { PaletteRuleExplainer } from "@/components/charts/PaletteRuleExplainer";
import { PaletteVerdict } from "@/components/charts/PaletteVerdict";
import { SystemAudit } from "@/components/charts/SystemAudit";
import { SectionNav } from "@/components/charts/SectionNav";
import { ReferenceDrawer } from "@/components/charts/ReferenceDrawer";
import { OPEN_REFERENCE_EVENT } from "@/components/charts/Term";
import { Evidence } from "@/components/charts/sections/Evidence";
import { Storytell } from "@/components/charts/sections/Storytell";
import { Reuse } from "@/components/charts/sections/Reuse";
import { Ship } from "@/components/charts/sections/Ship";
import { type SectionId } from "@/charts/urlState";
import { VisionPreviewToggle } from "@/components/charts/VisionPreviewToggle";
import { WorkflowPresets, type WorkflowState } from "@/components/charts/WorkflowPresets";
import { clearManualColorOverrides, hasManualColorOverrides } from "@/charts/manualOverrides";
import { safeMaxN, clearSafeMaxNCache } from "@/charts/builtinBounds";

type Vision = VisionMode;
const VISION_FILTER: Record<Vision, string> = {
  normal: "none",
  // SVG filter overlays applied to the chart container — approximate, for
  // visual smoke-testing. Authoritative numbers come from the contrast report.
  deutan: "url(#cvd-deutan)",
  protan: "url(#cvd-protan)",
  tritan: "url(#cvd-tritan)",
  achromatopsia: "url(#cvd-gray)",
};

function VisionFilters() {
  // Machado 2009 severity-1.0 matrices rounded to 3 dp. SVG filters apply
  // feColorMatrix in linearRGB by default, matching the linear-space math in
  // palette/cvd.ts, so the preview and the numeric audit agree. The gray
  // filter uses the same Rec. 709 luma coefficients as audit.ts toGrayscale.
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="cvd-deutan">
          <feColorMatrix
            type="matrix"
            values="0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0"
          />
        </filter>
        <filter id="cvd-protan">
          <feColorMatrix
            type="matrix"
            values="0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0"
          />
        </filter>
        <filter id="cvd-tritan">
          <feColorMatrix
            type="matrix"
            values="1.256 -0.077 -0.179 0 0  -0.078 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0"
          />
        </filter>
        <filter id="cvd-gray">
          <feColorMatrix
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
          />
        </filter>
      </defs>
    </svg>
  );
}

import {
  genLineData,
  genStackedData,
  genHeatmap,
  genDiverging,
  genScatter,
  genBubble,
  genRadar,
  genTreemapCategorical,
  genTreemapSequential,
  genSankey,
  genCandlestick,
  genChoropleth,
  genPie,
  type DataMode,
} from "@/charts/fixtures";

const SERIES_NAMES = [
  "Acme",
  "Globex",
  "Initech",
  "Umbrella",
  "Hooli",
  "Soylent",
  "Wonka",
  "Cyberdyne",
  "Massive Dynamic",
  "Stark",
  "Tyrell",
  "Wayne",
];

// Default number of data points/series on first load and whenever the chart
// kind changes. Two keeps the canvas readable out of the gate — users dial N up
// with the slider to stress-test the palette, rather than landing on a busy 12.
const DEFAULT_N = 2;

function clampBuiltInN(k: ChartKind, t: Theme, requested: number) {
  const r = BEST_PRACTICE[k];
  const min = r.family === "categorical" ? 1 : 3;
  const max = r.family === "categorical" ? Math.min(r.recommendedN, safeMaxN(t, r.posture)) : r.recommendedN;
  return Math.min(Math.max(min, requested), max);
}


/**
 * Isolated N-slider. Owns its own drag state so each pixel of movement only
 * re-renders this tiny component (not the 2700-line ChartsDemo tree). The
 * heavy palette-solver commit is deferred to `startTransition` on release.
 */
function NSlider({
  min,
  max,
  safe,
  committedValue,
  onCommit,
  title,
  overflowLabel,
}: {
  min: number;
  max: number;
  safe: number;
  committedValue: number;
  onCommit: (n: number) => void;
  title: string;
  overflowLabel?: string | null;
}) {
  // Fully uncontrolled: the native <input> drives its own thumb position with
  // zero React renders during drag. We mirror the live value into a sibling
  // <span> via a ref so the number updates instantly too. Commit (which runs
  // the heavy palette solver) only fires on release / keyup / blur.
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const draggingRef = useRef(false);
  const debounceRef = useRef<number | null>(null);
  const clamped = Math.min(committedValue, max);

  // Keep the uncontrolled input in sync when committedValue changes from
  // outside (preset clicks, URL load, etc.) — but never during an active drag.
  useEffect(() => {
    if (draggingRef.current) return;
    if (inputRef.current) inputRef.current.value = String(clamped);
    if (labelRef.current) labelRef.current.textContent = String(clamped);
  }, [clamped]);

  // Cleanup pending rAF on unmount.
  useEffect(() => () => {
    if (debounceRef.current !== null) cancelAnimationFrame(debounceRef.current);
  }, []);

  const commitValue = (v: number) => {
    if (v !== clamped) onCommit(v);
  };

  const commitNow = () => {
    if (debounceRef.current !== null) {
      cancelAnimationFrame(debounceRef.current);
      debounceRef.current = null;
    }
    draggingRef.current = false;
    commitValue(Number(inputRef.current?.value ?? clamped));
  };

  // Coalesce rapid scrubs to one commit per frame — the solver result for
  // each N is cached (and prewarmed on mount), so commits are effectively
  // instant. rAF (not setTimeout) keeps changes within the next paint.
  const scheduleCommit = () => {
    if (debounceRef.current !== null) cancelAnimationFrame(debounceRef.current);
    debounceRef.current = requestAnimationFrame(() => {
      debounceRef.current = null;
      commitValue(Number(inputRef.current?.value ?? clamped));
    });
  };

  const range = Math.max(1, max - min);
  const safeClamped = Math.min(Math.max(safe, min), max);
  const safePct = ((safeClamped - min) / range) * 100;
  // Track: safe zone in the focus tint, educational zone (past the safe cap)
  // in the warn tint — the slider itself shows where the guarantees end.
  const trackBg =
    safeClamped >= max
      ? `linear-gradient(to right, hsl(var(--chart-focus) / 0.35), hsl(var(--chart-focus) / 0.35))`
      : `linear-gradient(to right, hsl(var(--chart-focus) / 0.35) 0%, hsl(var(--chart-focus) / 0.35) ${safePct}%, hsl(var(--chart-warn) / 0.3) ${safePct}%, hsl(var(--chart-warn) / 0.3) 100%)`;

  const stepBy = (delta: number) => {
    const next = Math.min(max, Math.max(min, Number(inputRef.current?.value ?? clamped) + delta));
    if (inputRef.current) inputRef.current.value = String(next);
    if (labelRef.current) labelRef.current.textContent = String(next);
    draggingRef.current = false;
    commitValue(next);
  };

  const stepBtn =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-chart-grid bg-chart-bg text-base font-medium text-foreground transition-colors duration-150 hover:bg-chart-grid/40 active:scale-95 disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus";

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Decrease to ${clamped - 1}`} className={stepBtn} onClick={() => stepBy(-1)} disabled={clamped <= min}>
          −
        </button>
        <div className="relative flex-1 min-w-[240px]">
          <input
            ref={inputRef}
            type="range"
            min={min}
            max={max}
            defaultValue={clamped}
            onPointerDown={() => { draggingRef.current = true; }}
            onKeyDown={() => { draggingRef.current = true; }}
            onInput={(e) => {
              if (labelRef.current) labelRef.current.textContent = (e.target as HTMLInputElement).value;
              scheduleCommit();
            }}
            onPointerUp={commitNow}
            onKeyUp={commitNow}
            onBlur={commitNow}
            className="n-slider touch-none"
            style={{ "--n-track": trackBg } as CSSProperties}
            title={title}
          />
          {/* Tick per step; the safe-cap boundary tick is emphasized. */}
          <div className="pointer-events-none absolute inset-x-[11px] top-[19px] flex justify-between" aria-hidden>
            {Array.from({ length: range + 1 }, (_, i) => {
              const v = min + i;
              return (
                <span
                  key={v}
                  className={
                    v === safeClamped && safeClamped < max
                      ? "h-2 w-0.5 rounded-full bg-chart-warn"
                      : "h-1.5 w-px bg-chart-axis/40"
                  }
                />
              );
            })}
          </div>
          {/* min / safe / max labels aligned to their track positions. */}
          <div className="relative mx-[11px] h-4 text-[10px] leading-4 text-chart-axis" aria-hidden>
            <span className="absolute left-0">{min}</span>
            {safeClamped > min && safeClamped < max && (
              <span className="absolute -translate-x-1/2 font-medium text-foreground" style={{ left: `${safePct}%` }}>
                safe {safeClamped}
              </span>
            )}
            <span className="absolute right-0">
              {safeClamped >= max ? `safe · max ${max}` : `max ${max}`}
            </span>
          </div>
        </div>
        <button type="button" aria-label={`Increase to ${clamped + 1}`} className={stepBtn} onClick={() => stepBy(1)} disabled={clamped >= max}>
          +
        </button>
        <div className="flex min-w-[56px] shrink-0 flex-col items-center justify-center rounded-md border border-chart-grid bg-chart-bg px-2.5 py-1">
          <span ref={labelRef} className="tabular-nums text-lg font-semibold leading-5">
            {clamped}
          </span>
          <span className="text-[10px] leading-3 text-chart-axis">of {max}</span>
        </div>
      </div>
      {overflowLabel && (
        <p className="text-[11px] text-chart-negative-text" title={overflowLabel}>
          ⚠ above the safe cap ({safeClamped}) — the audit panel shows which floors break
        </p>
      )}
    </div>
  );
}


const ChartsDemo = () => {
  // Palette inputs the user can NEVER pick: posture, family, individual colors.
  // Context inputs the user CAN pick: chart kind, N, theme (light/dark — their
  // app's mode), and vision preview (to see what colorblind users see).
  const [kind, setKind] = useState<ChartKind>("line");
  const [requestedN, setRequestedN] = useState(DEFAULT_N);
  const [theme, setTheme] = useState<Theme>("light");
  const [vision, setVision] = useState<Vision>("normal");
  const [dataMode, setDataMode] = useState<DataMode>("synthetic");
  const [compare, setCompare] = useState(false);
  const [diffOverlay, setDiffOverlay] = useState(false);
  // Variant B — only used when compare is on AND vision is "normal"
  // (so the user is comparing two configurations rather than a CVD preview).
  const [kindB, setKindB] = useState<ChartKind>("bar");
  const [requestedNB, setRequestedNB] = useState(DEFAULT_N);

  const [themeB, setThemeB] = useState<Theme>("dark");
  // Bumped whenever the user edits a chart token via the ColorPicker, so the
  // memoized chart themes re-read CSS vars and the solver re-runs.
  const [colorRev, setColorRev] = useState(0);
  // (Slider drag state now lives inside the `NSlider` subcomponent so each
  // pixel of movement re-renders only the slider, not the whole tree.)
  const manualOverrides = useMemo(
    () => hasManualColorOverrides(theme),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, colorRev]
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [tourAutoOpen, dismissTour] = useShouldAutoOpenTour();
  const [tourManualOpen, setTourManualOpen] = useState(false);
  const tourOpen = tourAutoOpen || tourManualOpen;
  function setTourOpen(v: boolean) {
    if (v) setTourManualOpen(true);
    else {
      setTourManualOpen(false);
      dismissTour();
    }
  }
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [referenceTerm, setReferenceTerm] = useState<string | undefined>(undefined);
  const [section, setSection] = useState<SectionId | undefined>(undefined);

  /**
   * Navigate to a section.
   *
   * Only an explicit click writes `s` into the hash. The scrollspy inside
   * SectionNav never does: rewriting the hash on every scroll event fills the
   * history stack and destroys the back button.
   */
  function goToSection(id: SectionId) {
    setSection(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`section-${id}`)
      ?.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
  }

  // "?" opens the glossary from anywhere, and <Term> asks for a specific entry.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      // Never steal "?" from a field the user is typing in.
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "?") {
        setReferenceTerm(undefined);
        setReferenceOpen(true);
      }
    }
    function onOpenRef(e: Event) {
      setReferenceTerm((e as CustomEvent<string>).detail);
      setReferenceOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_REFERENCE_EVENT, onOpenRef);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_REFERENCE_EVENT, onOpenRef);
    };
  }, []);

  const firstKindRender = useRef(true);
  const skipNextKindSnap = useRef(false);
  const firstKindBRender = useRef(true);

  /**
   * Single source of truth for every palette change on `/charts`.
   *
   * All UI affordances — kind/N/theme controls beside the chart, variant-B
   * controls, palette presets, workflow presets, URL hydration, share link
   * deep-links — funnel through this one handler. The recommender controls
   * that used to mutate state directly are gone; nothing else is allowed
   * to call `setKind` / `setRequestedN` / `setTheme` (or their B-variant
   * counterparts) outside of this function, so every change is clamped to
   * `clampBuiltInN(kind, theme, n)` and runs the snap-skip guard exactly
   * once. This guarantees the builder beside the chart is the only path
   * that can change the palette.
   */
  function onApply(
    variant: "A" | "B",
    next: { kind?: ChartKind; n?: number; theme?: Theme }
  ) {
    const isA = variant === "A";
    const curKind = isA ? kind : kindB;
    const curTheme = isA ? theme : themeB;
    const curN = isA ? requestedN : requestedNB;
    const nextKind = next.kind ?? curKind;
    const nextTheme = next.theme ?? curTheme;
    // Preserve the user's N unless the KIND changes (a new kind snaps to its
    // default). A theme flip must never reset a dialed-in step count — it
    // only re-clamps if the new theme's safe range is narrower.
    const kindChanged = next.kind !== undefined && next.kind !== curKind;
    const fallbackN = kindChanged ? DEFAULT_N : curN;
    const nextN = clampBuiltInN(nextKind, nextTheme, next.n ?? fallbackN);
    if (isA) {
      skipNextKindSnap.current = true;
      if (next.kind && next.kind !== kind) setKind(next.kind);
      if (next.theme && next.theme !== theme) setTheme(next.theme);
      setRequestedN(nextN);
    } else {
      if (next.kind && next.kind !== kindB) setKindB(next.kind);
      if (next.theme && next.theme !== themeB) setThemeB(next.theme);
      setRequestedNB(nextN);
    }
    // The tour stays open across builder changes — it re-measures its anchor
    // on a tick, so users can try the control a step describes without the
    // tour vanishing mid-sentence.
  }

  // Back-compat shims — the rest of the file (and any future caller) MUST
  // route through `onApply`. These thin wrappers exist only so the diff
  // stays small; do not add new call sites.
  const applyPrimaryBuilder = (n: { kind?: ChartKind; n?: number; theme?: Theme }) => onApply("A", n);
  const applyVariantB = (n: { kind?: ChartKind; n?: number; theme?: Theme }) => onApply("B", n);


  useEffect(() => {
    clearManualColorOverrides();
    clearChartThemeCache();
    clearSafeMaxNCache();
    setColorRev((r) => r + 1);
  }, []);

  // Prewarm the categorical solver cache for every (theme, posture, N) the
  // slider can produce. The solver is the heaviest step in a palette change
  // (~1200+200N annealing iterations, O(N²) per step), and the result is
  // cached by `getChartTheme`. Warming on mount — chunked across idle frames
  // so we don't block first paint — means slider scrubs become instant cache
  // hits instead of triggering a fresh solve per value.
  useEffect(() => {
    const themes: Theme[] = ["light", "dark"];
    const postures: Posture[] = ["comparative", "exploratory", "kpi"];
    const tasks: Array<() => void> = [];
    for (const t of themes) {
      for (const p of postures) {
        const cap = POSTURE[p].maxCategorical;
        for (let n = 1; n <= cap; n++) {
          tasks.push(() => { getChartTheme(t, p, n); });
        }
      }
    }
    let cancelled = false;
    let i = 0;
    const runChunk = (deadline?: IdleDeadline) => {
      if (cancelled) return;
      const hasTime = () => (deadline ? deadline.timeRemaining() > 4 : true);
      while (i < tasks.length && hasTime()) tasks[i++]();
      if (i < tasks.length) schedule();
    };
    const schedule = () => {
      const w = window as Window & { requestIdleCallback?: (cb: (d: IdleDeadline) => void) => number };
      if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(runChunk);
      else setTimeout(() => runChunk(), 16);
    };
    schedule();
    return () => { cancelled = true; };
  }, []);



  // Bidirectional sync between builder state and URL hash so links are shareable.
  const urlState: UrlState = {
    kind,
    n: requestedN,
    theme,
    vision,
    compare,
    kindB,
    nB: requestedNB,
    themeB,
    section,
  };
  useUrlStateSync(urlState, (s) => {
    if (s.section) {
      setSection(s.section);
      scrollToSectionWhenSettled(s.section);
    }
    if (s.kind || s.theme || typeof s.n === "number") {
      applyPrimaryBuilder({ kind: s.kind, theme: s.theme, n: s.n });
    }
    if (s.vision) setVision(s.vision);
    if (typeof s.compare === "boolean") setCompare(s.compare);
    if (s.kindB || s.themeB || typeof s.nB === "number") {
      applyVariantB({ kind: s.kindB, theme: s.themeB, n: s.nB });
    }
  });


  const rule = BEST_PRACTICE[kind];
  const family = rule.family;
  const posture = rule.posture;
  // Best-practice bounds for the slider — N is always within [minN, sliderMax].
  const minN = rule.family === "categorical" ? 1 : 3;
  // Slider max is the kind's recommendedN (12 for categorical) — users can pick
  // any value in range. The runtime-probed safe cap (`safeBuiltinMaxA`) is shown
  // as a guidance marker; values above it surface warnings via the audit panel
  // so people can see and learn from their mistakes instead of being blocked.
  const sliderMaxA = rule.recommendedN;
  const safeBuiltinMaxA =
    family === "categorical"
      ? Math.min(rule.recommendedN, safeMaxN(theme, posture))
      : rule.recommendedN;
  const n = Math.min(Math.max(minN, requestedN), sliderMaxA);
  const overflow = family === "categorical" && n > safeBuiltinMaxA;
  const warning = rule.warn?.(n) ?? null;

  // Variant B derived values (only meaningful when compare && vision === "normal").
  const ruleB = BEST_PRACTICE[kindB];
  const minNB = ruleB.family === "categorical" ? 1 : 3;
  const sliderMaxB = ruleB.recommendedN;
  const safeBuiltinMaxB =
    ruleB.family === "categorical"
      ? Math.min(ruleB.recommendedN, safeMaxN(themeB, ruleB.posture))
      : ruleB.recommendedN;
  const nB = Math.min(Math.max(minNB, requestedNB), sliderMaxB);

  // Auto-clamp requestedN when the chart kind changes so the slider stays
  // within the new kind's best-practice [minN, maxN]. If the previous value
  // is out of range, snap to the recommendedN for the new kind.
  // Always snap to the new kind's recommended N — built-in controls must
  // auto-enforce best practices. Skip the very first render so a shared URL
  // with a non-recommended N (?n=…) survives hydration.
  // Kind changes only — a theme flip keeps the user's dialed-in N (onApply
  // re-clamps it against the new theme's range).
  useEffect(() => {
    if (firstKindRender.current) { firstKindRender.current = false; return; }
    if (skipNextKindSnap.current) { skipNextKindSnap.current = false; return; }
    setRequestedN(Math.min(DEFAULT_N, safeBuiltinMaxA));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  useEffect(() => {
    if (firstKindBRender.current) { firstKindBRender.current = false; return; }
    setRequestedNB(Math.min(DEFAULT_N, safeBuiltinMaxB));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindB]);


  const themeNB = ruleB.family === "categorical" ? nB : 1;
  const chartThemeB = useMemo(
    () => getChartTheme(themeB, ruleB.posture, themeNB),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themeB, ruleB.posture, themeNB, colorRev]
  );

  // Sync the `.dark` class on <html> with the chart theme BEFORE paint so
  // `getChartTheme("light")` reads the light `--chart-*` tokens off
  // documentElement (and not the dark ones left over from the previous theme).
  // Without useLayoutEffect + colorRev bump, the chartTheme useMemo above
  // resolved its tokens against the stale documentElement class, leaving
  // the chart visually dark even after the user picked "light".
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    clearChartThemeCache();
    clearSafeMaxNCache();
    setColorRev((r) => r + 1);
  }, [theme]);

  const themeN = family === "categorical" ? n : 1;
  // Bumped whenever entity pins change so the chart re-applies the permutation.
  const [pinRev, setPinRev] = useState(0);
  const rawChartTheme = useMemo(
    () => getChartTheme(theme, posture, themeN),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, posture, themeN, colorRev]
  );
  const chartTheme = useMemo(() => {
    if (family !== "categorical") return rawChartTheme;
    const entities = SERIES_NAMES.slice(0, rawChartTheme.effectiveN);
    const { slots } = buildPinPermutation(entities, rawChartTheme.effectiveN);
    return applyPinsToTheme(rawChartTheme, slots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawChartTheme, family, pinRev]);

  // Audit always runs against the actual rendered palette (categorical) or
  // the derived ramp (sequential / diverging).
  const auditedColors = useMemo(() => {
    if (family === "categorical") return chartTheme.solve.palette;
    if (family === "sequential")
      return sequentialRamp(chartTheme.tokens.seqLow, chartTheme.tokens.seqHigh, n);
    return divergingRamp(
      chartTheme.tokens.divNeg,
      chartTheme.tokens.divMid,
      chartTheme.tokens.divPos,
      Math.max(3, n)
    );
  }, [chartTheme, family, n]);
  const auditedColorsB = useMemo(() => {
    const fam = ruleB.family;
    if (fam === "categorical") return chartThemeB.solve.palette;
    if (fam === "sequential")
      return sequentialRamp(chartThemeB.tokens.seqLow, chartThemeB.tokens.seqHigh, nB);
    return divergingRamp(
      chartThemeB.tokens.divNeg,
      chartThemeB.tokens.divMid,
      chartThemeB.tokens.divPos,
      Math.max(3, nB)
    );
  }, [chartThemeB, ruleB.family, nB]);
  const audit = useMemo(
    () => auditPalette(auditedColors, chartTheme.tokens.bg, family !== "categorical"),
    [auditedColors, chartTheme, family]
  );
  const auditB = useMemo(
    () => auditPalette(auditedColorsB, chartThemeB.tokens.bg, ruleB.family !== "categorical"),
    [auditedColorsB, chartThemeB, ruleB.family]
  );

  // Build the prioritized warning list for any (kind, n, audit) tuple.
  function buildWarningList(
    k: ChartKind,
    r: ReturnType<typeof BEST_PRACTICE[ChartKind] extends infer T ? () => T : never> | typeof rule,
    requested: number,
    rendered: number,
    capped: boolean,
    a: AuditReport,
    relax: string[]
  ) {
    const ws: Array<{ severity: "error" | "warn" | "info"; title: string; detail: string }> = [];
    const w = r.warn?.(rendered) ?? null;
    if (capped) {
      ws.push({
        severity: "error",
        title: `N=${requested} exceeds the ${CHART_KIND_LABEL[k]} hard cap of ${r.maxN}`,
        detail: `Slots past ${r.maxN} were collapsed into "Other". Lower N or pick a chart type that supports more series.`,
      });
    }
    if (w) {
      ws.push({
        severity: "warn",
        title: w,
        detail: `${CHART_KIND_LABEL[k]} recommends N ≤ ${r.recommendedN}; rendering ${rendered}.`,
      });
    } else if (rendered > r.recommendedN && !capped) {
      ws.push({
        severity: "warn",
        title: `N=${rendered} is above the recommended ${r.recommendedN} for ${CHART_KIND_LABEL[k]}`,
        detail: `Past ${r.recommendedN} slots, dash / decal / shape carry identity rather than color.`,
      });
    }
    for (const v of a.perVision) {
      if (!v.pass) {
        ws.push({
          severity: v.mode === "normal" ? "error" : "warn",
          title: `${v.mode} fails ${v.mode === "achromatopsia" ? "ΔL" : "ΔE"} ≥ ${v.threshold < 1 ? v.threshold.toFixed(1) : v.threshold.toFixed(0)} (got ${v.minDeltaE.toFixed(1)})`,
          detail:
            v.mode === "achromatopsia"
              ? "Two slots collapse to indistinguishable grays — meaning will be lost in print, projector, or grayscale screenshots."
              : v.mode === "normal"
              ? "Two slots are too close even in normal vision. Lower N or change chart type."
              : "Two slots simulate to indistinguishable colors under this CVD type. Dash, decal, and shape still differentiate them, but color alone won't.",
        });
      }
    }
    if (!a.bgPass) {
      ws.push({
        severity: "error",
        title: `Contrast vs. background ${a.worstContrastVsBg.toFixed(2)}:1 fails WCAG 2.2 SC 1.4.11 (≥ 3:1)`,
        detail: "At least one mark color blends into the chart background.",
      });
    }
    for (const rx of relax) {
      ws.push({
        severity: "info",
        title: `Solver relaxed: ${rx}`,
        detail: "The optimizer couldn't satisfy this constraint at the current N and loosened it. Lower N to restore it.",
      });
    }
    return ws;
  }

  const warnings = useMemo(
    () => buildWarningList(kind, rule, requestedN, n, overflow, audit, chartTheme.solve.relaxations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overflow, requestedN, kind, rule, n, audit, chartTheme.solve.relaxations]
  );
  const overflowB = ruleB.family === "categorical" && nB > safeBuiltinMaxB;
  const warningsB = useMemo(
    () => buildWarningList(kindB, ruleB, requestedNB, nB, overflowB, auditB, chartThemeB.solve.relaxations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overflowB, requestedNB, kindB, ruleB, nB, auditB, chartThemeB.solve.relaxations]
  );



  function buildOption(kind: ChartKind, n: number, chartTheme: ReturnType<typeof getChartTheme>, dm: DataMode) {
    const base = buildBase(chartTheme);
    switch (kind) {
      case "line":
        return {
          ...base,
          legend: { ...base.legend, top: 0 },
          xAxis: { ...base.xAxis, type: "value" },
          yAxis: { ...base.yAxis, type: "value" },
          series: buildLineSeries(chartTheme, genLineData(chartTheme.effectiveN, dm)),
        };
      case "bar": {
        const { categories, series } = genStackedData(chartTheme.effectiveN, dm);
        return {
          ...base,
          legend: { ...base.legend, top: 0 },
          aria: { enabled: true, decal: { show: true } },
          xAxis: { ...base.xAxis, type: "category", data: categories },
          yAxis: { ...base.yAxis, type: "value" },
          series: buildBarSeries(
            chartTheme,
            series.map((s) => ({ name: s.name, data: s.data }))
          ),
        };
      }
      case "stacked-bar": {
        const { categories, series } = genStackedData(chartTheme.effectiveN, dm);
        return {
          ...base,
          legend: { ...base.legend, top: 0 },
          aria: { enabled: true, decal: { show: true } },
          xAxis: { ...base.xAxis, type: "category", data: categories },
          yAxis: { ...base.yAxis, type: "value" },
          series: buildBarSeries(chartTheme, series),
        };
      }
      case "scatter": {
        const scatterData = genScatter(chartTheme.effectiveN, dm);
        const series = scatterData.map((s, i) => ({
          name: s.name,
          type: "scatter" as const,
          symbol: chartTheme.shapes[i],
          symbolSize: 12,
          itemStyle: { color: chartTheme.colorHexes[i], opacity: 0.85 },
          data: s.data,
        }));
        return {
          ...base,
          legend: { ...base.legend, top: 0 },
          xAxis: { ...base.xAxis, type: "value" },
          yAxis: { ...base.yAxis, type: "value" },
          series,
        };
      }
      case "pie": {
        const data = genPie(chartTheme.effectiveN, dm).map((d, i) => ({
          ...d,
          itemStyle: { color: chartTheme.colorHexes[i], decal: chartTheme.decals[i] },
        }));
        return {
          backgroundColor: chartTheme.tokens.bg.hex,
          textStyle: base.textStyle,
          tooltip: base.tooltip,
          legend: { ...base.legend, top: 0 },
          aria: { enabled: true, decal: { show: true } },
          series: [
            {
              type: "pie",
              radius: "70%",
              data,
              label: { color: chartTheme.tokens.axis.hex },
            },
          ],
        };
      }
      case "heatmap": {
        const { days, hours, data } = genHeatmap(dm);
        return {
          ...base,
          tooltip: { ...base.tooltip, position: "top" },
          // Room for the piecewise legend labels on the right.
          grid: { ...base.grid, right: 150 },
          xAxis: { ...base.xAxis, type: "category", data: hours },
          yAxis: { ...base.yAxis, type: "category", data: days },
          visualMap: buildVisualMap(chartTheme, "sequential", { min: 0, max: 110, steps: n }),
          series: [
            {
              type: "heatmap",
              data,
              emphasis: { itemStyle: { borderColor: chartTheme.tokens.axis.hex, borderWidth: 1 } },
            },
          ],
        };
      }
      case "diverging-bar": {
        const data = genDiverging(dm);
        // Compute range from actual data so the scale always fits — no hardcoded ±50.
        const absMax = Math.max(...data.map((d) => Math.abs(d.value)));
        const range = Math.ceil(absMax / 10) * 10 || 10;
        return {
          ...base,
          grid: { ...base.grid, right: 110 },
          xAxis: { ...base.xAxis, type: "value" },
          yAxis: { ...base.yAxis, type: "category", data: data.map((d) => d.name) },
          visualMap: {
            ...buildVisualMap(chartTheme, "diverging", { min: -range, max: range, steps: Math.max(3, n) }),
            dimension: 0,
          },
          series: [
            {
              type: "bar",
              data: data.map((d) => d.value),
              label: { show: true, color: chartTheme.tokens.axis.hex },
            },
          ],
        };
      }

      // --- New categorical kinds ---
      case "area": {
        const series = buildLineSeries(chartTheme, genLineData(chartTheme.effectiveN, dm)).map((s) => ({
          ...s,
          areaStyle: { color: s.color, opacity: 0.35 },
        }));
        return {
          ...base,
          legend: { ...base.legend, top: 0 },
          xAxis: { ...base.xAxis, type: "value" },
          yAxis: { ...base.yAxis, type: "value" },
          series,
        };
      }
      case "stacked-area": {
        const series = buildLineSeries(chartTheme, genLineData(chartTheme.effectiveN, dm)).map((s) => ({
          ...s,
          stack: "total",
          areaStyle: { color: s.color, opacity: 0.7 },
        }));
        return {
          ...base,
          legend: { ...base.legend, top: 0 },
          xAxis: { ...base.xAxis, type: "value", boundaryGap: false },
          yAxis: { ...base.yAxis, type: "value" },
          series,
        };
      }
      case "grouped-bar": {
        const { categories, series } = genStackedData(chartTheme.effectiveN, dm);
        return {
          ...base,
          legend: { ...base.legend, top: 0 },
          aria: { enabled: true, decal: { show: true } },
          xAxis: { ...base.xAxis, type: "category", data: categories },
          yAxis: { ...base.yAxis, type: "value" },
          series: buildBarSeries(
            chartTheme,
            series.map((s) => ({ name: s.name, data: s.data })) // no stack
          ),
        };
      }
      case "bubble": {
        const bubbleData = genBubble(chartTheme.effectiveN, dm);
        const series = bubbleData.map((s, i) => ({
          name: s.name,
          type: "scatter" as const,
          symbol: chartTheme.shapes[i],
          itemStyle: { color: chartTheme.colorHexes[i], opacity: 0.7 },
          symbolSize: (d: number[]) => 8 + d[2] * 1.5,
          data: s.data,
        }));
        return {
          ...base,
          legend: { ...base.legend, top: 0 },
          xAxis: { ...base.xAxis, type: "value" },
          yAxis: { ...base.yAxis, type: "value" },
          series,
        };
      }
      case "donut": {
        const data = genPie(chartTheme.effectiveN, dm).map((d, i) => ({
          ...d,
          itemStyle: { color: chartTheme.colorHexes[i], decal: chartTheme.decals[i] },
        }));
        return {
          backgroundColor: chartTheme.tokens.bg.hex,
          textStyle: base.textStyle,
          tooltip: base.tooltip,
          legend: { ...base.legend, top: 0 },
          aria: { enabled: true, decal: { show: true } },
          series: [
            {
              type: "pie",
              radius: ["55%", "80%"],
              data,
              label: { color: chartTheme.tokens.axis.hex },
            },
          ],
        };
      }
      case "radar": {
        const indicator = ["Speed", "Reliability", "Comfort", "Safety", "Efficiency", "Cost"].map((name) => ({
          name,
          max: 100,
        }));
        const radarData = genRadar(chartTheme.effectiveN, dm);
        const series = [
          {
            type: "radar" as const,
            data: radarData.map((item, i) => ({
              name: item.name,
              value: item.value,
              lineStyle: {
                color: chartTheme.colorHexes[i],
                type: chartTheme.dashes[i] === "solid" ? "solid" : (chartTheme.dashes[i] as number[]),
              },
              itemStyle: { color: chartTheme.colorHexes[i] },
              areaStyle: { color: chartTheme.colorHexes[i], opacity: 0.15 },
            })),
          },
        ];
        return {
          backgroundColor: chartTheme.tokens.bg.hex,
          textStyle: base.textStyle,
          tooltip: base.tooltip,
          legend: { ...base.legend, top: 0 },
          radar: {
            indicator,
            axisName: { color: chartTheme.tokens.axis.hex },
            splitLine: { lineStyle: { color: chartTheme.tokens.grid.hex } },
            axisLine: { lineStyle: { color: chartTheme.tokens.grid.hex } },
            splitArea: { show: false },
          },
          series,
        };
      }
      case "treemap-categorical": {
        const data = genTreemapCategorical(chartTheme.effectiveN, dm).map((d, i) => ({
          ...d,
          itemStyle: { color: chartTheme.colorHexes[i] },
        }));
        return {
          backgroundColor: chartTheme.tokens.bg.hex,
          tooltip: base.tooltip,
          series: [
            {
              type: "treemap",
              data,
              roam: false,
              breadcrumb: { show: false },
              label: { color: chartTheme.tokens.bg.hex, fontWeight: 600 },
              itemStyle: { borderColor: chartTheme.tokens.bg.hex, borderWidth: 2 },
            },
          ],
        };
      }
      case "sankey": {
        const sources = Array.from({ length: chartTheme.effectiveN }, (_, i) => SERIES_NAMES[i]);
        const targets = ["Retained", "Churned", "Upgraded"];
        const nodes = [
          ...sources.map((s, i) => ({
            name: s,
            itemStyle: { color: chartTheme.colorHexes[i] },
          })),
          ...targets.map((t) => ({ name: t, itemStyle: { color: chartTheme.tokens.muted.hex } })),
        ];
        const sankeyLinks = genSankey(sources, targets, dm);
        const links = sankeyLinks.map((l) => {
          const si = sources.indexOf(l.source);
          return {
            ...l,
            lineStyle: { color: chartTheme.colorHexes[si] ?? chartTheme.tokens.muted.hex, opacity: 0.4 },
          };
        });
        return {
          backgroundColor: chartTheme.tokens.bg.hex,
          tooltip: base.tooltip,
          series: [
            {
              type: "sankey",
              data: nodes,
              links,
              label: { color: chartTheme.tokens.axis.hex },
            },
          ],
        };
      }

      // --- New sequential kinds ---
      case "calendar-heatmap": {
        const start = new Date(2026, 0, 1);
        const data: Array<[string, number]> = [];
        for (let d = 0; d < 365; d++) {
          const date = new Date(start.getTime() + d * 86400000);
          data.push([date.toISOString().slice(0, 10), Math.round(20 + 60 * Math.abs(Math.sin(d / 9)))]);
        }
        return {
          backgroundColor: chartTheme.tokens.bg.hex,
          tooltip: base.tooltip,
          visualMap: { ...buildVisualMap(chartTheme, "sequential", { min: 0, max: 100, steps: n }), orient: "horizontal", left: "center", top: 0 },
          calendar: {
            range: "2026",
            cellSize: ["auto", 14],
            itemStyle: { borderColor: chartTheme.tokens.bg.hex, borderWidth: 2, color: chartTheme.tokens.surface.hex },
            dayLabel: { color: chartTheme.tokens.axis.hex },
            monthLabel: { color: chartTheme.tokens.axis.hex },
            yearLabel: { show: false },
            splitLine: { lineStyle: { color: chartTheme.tokens.grid.hex } },
          },
          series: [{ type: "heatmap", coordinateSystem: "calendar", data }],
        };
      }
      case "choropleth": {
        // No GeoJSON loaded — render a grid of "regions" as a proxy so the
        // sequential ramp + threshold steps are still visualized.
        const regions = genChoropleth(dm);
        return {
          ...base,
          tooltip: { ...base.tooltip, position: "top" },
          xAxis: { ...base.xAxis, type: "category", data: ["A", "B", "C", "D", "E", "F"], show: false },
          yAxis: { ...base.yAxis, type: "category", data: ["1", "2", "3", "4", "5", "6"], show: false },
          // type:"piecewise" + splitNumber:n creates n discrete bins matching the
          // audited ramp steps, so rendered colors align with the audited palette.
          visualMap: { ...buildVisualMap(chartTheme, "sequential", { min: 0, max: 100, steps: n }), type: "piecewise", splitNumber: n },
          series: [
            {
              type: "heatmap",
              data: regions,
              itemStyle: { borderColor: chartTheme.tokens.bg.hex, borderWidth: 2 },
            },
          ],
        };
      }
      case "treemap-sequential": {
        const ramp = sequentialRamp(chartTheme.tokens.seqLow, chartTheme.tokens.seqHigh, n).map((c) => c.hex);
        const data = genTreemapSequential(dm).map(({ value }, i) => {
          const v01 = value / 200; // normalise to ~[0,1]
          const bucket = Math.min(n - 1, Math.floor(v01 * n));
          return {
            name: `Item ${i + 1}`,
            value,
            itemStyle: { color: ramp[bucket] },
          };
        });
        return {
          backgroundColor: chartTheme.tokens.bg.hex,
          tooltip: base.tooltip,
          series: [
            {
              type: "treemap",
              data,
              roam: false,
              breadcrumb: { show: false },
              label: { color: chartTheme.tokens.bg.hex, fontWeight: 600 },
              itemStyle: { borderColor: chartTheme.tokens.bg.hex, borderWidth: 2 },
            },
          ],
        };
      }
      case "density": {
        const data: Array<[number, number, number]> = [];
        for (let x = 0; x < 30; x++) {
          for (let y = 0; y < 18; y++) {
            const v =
              80 * Math.exp(-((x - 10) ** 2 + (y - 9) ** 2) / 30) +
              60 * Math.exp(-((x - 22) ** 2 + (y - 6) ** 2) / 20);
            data.push([x, y, Math.round(v)]);
          }
        }
        return {
          ...base,
          tooltip: { ...base.tooltip, position: "top" },
          xAxis: { ...base.xAxis, type: "category", data: Array.from({ length: 30 }, (_, i) => `${i}`), show: false },
          yAxis: { ...base.yAxis, type: "category", data: Array.from({ length: 18 }, (_, i) => `${i}`), show: false },
          visualMap: buildVisualMap(chartTheme, "sequential", { min: 0, max: 100, steps: n }),
          series: [{ type: "heatmap", data, emphasis: { itemStyle: { borderColor: chartTheme.tokens.axis.hex } } }],
        };
      }

      // --- New diverging kinds ---
      case "diverging-heatmap": {
        const data: Array<[number, number, number]> = [];
        for (let x = 0; x < 12; x++) {
          for (let y = 0; y < 12; y++) {
            const v = x === y ? 100 : Math.round(100 * (Math.cos((x - y) / 2) - 0.1));
            data.push([x, y, v]);
          }
        }
        return {
          ...base,
          tooltip: { ...base.tooltip, position: "top" },
          xAxis: { ...base.xAxis, type: "category", data: Array.from({ length: 12 }, (_, i) => `v${i}`) },
          yAxis: { ...base.yAxis, type: "category", data: Array.from({ length: 12 }, (_, i) => `v${i}`) },
          visualMap: buildVisualMap(chartTheme, "diverging", { min: -100, max: 100, steps: Math.max(3, n) }),
          series: [{ type: "heatmap", data }],
        };
      }
      case "waterfall": {
        // ECharts waterfall idiom: one transparent "placeholder" stack + a
        // colored "value" stack. Three semantic colors: positive, negative,
        // subtotal — driven from tokens.
        const steps = [
          { label: "Start", value: 100, kind: "subtotal" as const },
          { label: "Q1", value: 30, kind: "pos" as const },
          { label: "Q2", value: -20, kind: "neg" as const },
          { label: "Q3", value: 45, kind: "pos" as const },
          { label: "Q4", value: -15, kind: "neg" as const },
          { label: "End", value: 140, kind: "subtotal" as const },
        ];
        let running = 0;
        const placeholder: number[] = [];
        const values: Array<{ value: number; itemStyle: { color: string } }> = [];
        steps.forEach((s, i) => {
          if (s.kind === "subtotal") {
            placeholder.push(0);
            values.push({ value: s.value, itemStyle: { color: chartTheme.tokens.target.hex } });
            running = s.value;
          } else if (s.value >= 0) {
            placeholder.push(running);
            values.push({ value: s.value, itemStyle: { color: chartTheme.tokens.positive.hex } });
            running += s.value;
          } else {
            running += s.value;
            placeholder.push(running);
            values.push({ value: -s.value, itemStyle: { color: chartTheme.tokens.negative.hex } });
          }
          void i;
        });
        return {
          ...base,
          legend: { ...base.legend, top: 0, data: ["Subtotal", "Increase", "Decrease"] },
          xAxis: { ...base.xAxis, type: "category", data: steps.map((s) => s.label) },
          yAxis: { ...base.yAxis, type: "value" },
          series: [
            {
              name: "placeholder",
              type: "bar",
              stack: "all",
              itemStyle: { color: "transparent" },
              data: placeholder,
              tooltip: { show: false },
            },
            {
              name: "value",
              type: "bar",
              stack: "all",
              data: values,
              label: { show: true, color: chartTheme.tokens.axis.hex },
            },
          ],
        };
      }

      // --- Additional kinds ---
      case "step-line": {
        const series = buildLineSeries(chartTheme, genLineData(chartTheme.effectiveN, dm)).map((s) => ({
          ...s,
          step: "end" as const,
        }));
        return {
          ...base,
          legend: { ...base.legend, top: 0 },
          xAxis: { ...base.xAxis, type: "value" },
          yAxis: { ...base.yAxis, type: "value" },
          series,
        };
      }
      case "horizontal-bar": {
        const { categories, series } = genStackedData(chartTheme.effectiveN, dm);
        return {
          ...base,
          legend: { ...base.legend, top: 0 },
          aria: { enabled: true, decal: { show: true } },
          xAxis: { ...base.xAxis, type: "value" },
          yAxis: { ...base.yAxis, type: "category", data: categories },
          series: buildBarSeries(
            chartTheme,
            series.map((s) => ({ name: s.name, data: s.data }))
          ),
        };
      }
      case "rose": {
        const data = genPie(chartTheme.effectiveN, dm).map((d, i) => ({
          ...d,
          itemStyle: { color: chartTheme.colorHexes[i], decal: chartTheme.decals[i] },
        }));
        return {
          backgroundColor: chartTheme.tokens.bg.hex,
          textStyle: base.textStyle,
          tooltip: base.tooltip,
          legend: { ...base.legend, top: 0 },
          aria: { enabled: true, decal: { show: true } },
          series: [
            {
              type: "pie",
              radius: ["15%", "75%"],
              roseType: "area",
              data,
              label: { color: chartTheme.tokens.axis.hex },
            },
          ],
        };
      }
      case "boxplot": {
        const groups = Array.from({ length: chartTheme.effectiveN }, (_, i) => SERIES_NAMES[i]);
        // ECharts boxplot expects [min, Q1, median, Q3, max].
        const data = groups.map((_, i) => {
          const m = 50 + i * 3;
          return [m - 25, m - 10, m, m + 12, m + 28];
        });
        return {
          ...base,
          legend: { ...base.legend, top: 0, show: false },
          xAxis: { ...base.xAxis, type: "category", data: groups },
          yAxis: { ...base.yAxis, type: "value" },
          // Single series; per-box color via itemStyle callback so we don't
          // emit null-padded series (ECharts boxplot crashes on null data).
          series: [
            {
              name: "Distribution",
              type: "boxplot" as const,
              data: data.map((d, i) => ({
                value: d,
                itemStyle: {
                  color: chartTheme.colorHexes[i],
                  borderColor: chartTheme.colorHexes[i],
                },
              })),
            },
          ],
        };
      }
      case "funnel": {
        // Funnel is ordered largest→smallest; sort genPie output descending.
        const data = genPie(chartTheme.effectiveN, dm)
          .sort((a, b) => b.value - a.value)
          .map((d, i) => ({
            ...d,
            itemStyle: { color: chartTheme.colorHexes[i], decal: chartTheme.decals[i] },
          }));
        return {
          backgroundColor: chartTheme.tokens.bg.hex,
          textStyle: base.textStyle,
          tooltip: base.tooltip,
          legend: { ...base.legend, top: 0 },
          aria: { enabled: true, decal: { show: true } },
          series: [
            {
              type: "funnel",
              left: "10%",
              right: "10%",
              top: 40,
              bottom: 20,
              data,
              label: { color: chartTheme.tokens.bg.hex, fontWeight: 600 },
            },
          ],
        };
      }
      case "gauge": {
        // Sequential ramp drives the gauge bands.
        const ramp = sequentialRamp(chartTheme.tokens.seqLow, chartTheme.tokens.seqHigh, n);
        const stops = ramp.map((c, i) => [(i + 1) / ramp.length, c.hex] as [number, string]);
        return {
          backgroundColor: chartTheme.tokens.bg.hex,
          textStyle: base.textStyle,
          tooltip: base.tooltip,
          series: [
            {
              type: "gauge",
              startAngle: 200,
              endAngle: -20,
              min: 0,
              max: 100,
              progress: { show: false },
              axisLine: {
                lineStyle: { width: 18, color: stops },
              },
              axisTick: { lineStyle: { color: chartTheme.tokens.axis.hex } },
              splitLine: { lineStyle: { color: chartTheme.tokens.axis.hex } },
              axisLabel: { color: chartTheme.tokens.axis.hex, distance: 22 },
              pointer: { itemStyle: { color: chartTheme.tokens.axis.hex } },
              detail: {
                valueAnimation: true,
                color: chartTheme.tokens.axis.hex,
                formatter: "{value}%",
              },
              data: [{ value: 72 }],
            },
          ],
        };
      }
      case "candlestick": {
        // Two semantic colors from the diverging tokens: up (positive) / down (negative).
        const up = chartTheme.tokens.divPos.hex;
        const down = chartTheme.tokens.divNeg.hex;
        const ohlc = genCandlestick(dm);
        const data = ohlc.map(({ open, close, low, high }) => [open, close, low, high]);
        return {
          ...base,
          xAxis: {
            ...base.xAxis,
            type: "category",
            data: data.map((_, i) => `${i + 1}`),
          },
          yAxis: { ...base.yAxis, type: "value", scale: true },
          series: [
            {
              type: "candlestick",
              data,
              itemStyle: {
                color: up,
                color0: down,
                borderColor: up,
                borderColor0: down,
              },
            },
          ],
        };
      }
    }
  }
  const option = useMemo(() => buildOption(kind, n, chartTheme, dataMode), [kind, n, chartTheme, dataMode]);
  const optionB = useMemo(() => buildOption(kindB, nB, chartThemeB, dataMode), [kindB, nB, chartThemeB, dataMode]);

  return (
    <div className="min-h-dvh bg-[hsl(var(--page-bg))] text-foreground">
      <VisionFilters />
      {/* One 48px bar carries global actions AND section nav. Two stacked
          sticky rows would eat 100px of every screen forever. */}
      <div className="sticky top-0 z-40 border-b border-chart-grid bg-[hsl(var(--page-bg)/0.92)] backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1 px-6 py-1.5 sm:h-12 sm:flex-nowrap sm:py-0">
          <div
            className="flex h-6 w-6 shrink-0 items-end justify-center gap-0.5 rounded bg-primary p-1"
            aria-hidden
          >
            <span className="w-1 rounded-sm" style={{ height: "45%", background: "hsl(var(--chart-cat-anchor-1))" }} />
            <span className="w-1 rounded-sm" style={{ height: "100%", background: "hsl(var(--chart-cat-anchor-2))" }} />
            <span className="w-1 rounded-sm" style={{ height: "70%", background: "hsl(var(--chart-cat-anchor-3))" }} />
          </div>
          <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
            <SectionNav onNavigate={goToSection} />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setReferenceTerm(undefined);
                setReferenceOpen(true);
              }}
              className="tap-target rounded-md border border-chart-grid bg-chart-surface px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-chart-grid/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
              title="Open the glossary (? from anywhere)"
            >
              Glossary
            </button>
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="tap-target rounded-md border border-chart-grid bg-chart-surface px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-chart-grid/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
              title="Replay the 4-step coach tour"
            >
              <span className="sm:hidden">Tour</span>
              <span className="hidden sm:inline">Take the tour</span>
            </button>
          </div>
        </div>
        {/* The verdict lives with the nav, not beside the chart. Pinned inside
            the chart column it sat at 863px on a 720px viewport at scroll 0 --
            visible everywhere except the one place everybody starts. */}
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-6 pb-2">
          <PaletteVerdict
            audit={audit}
            relaxations={chartTheme.solve.relaxations}
            label={compare ? "A" : undefined}
            dense={compare}
          />
          {compare && (
            <PaletteVerdict
              audit={auditB}
              relaxations={chartThemeB.solve.relaxations}
              label="B"
              dense
            />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-6">
        {/* Title scrolls away. It earns its space once, not on every screen. */}
        <header className="min-w-0">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Micah's Chart System{" "}
            <span className="text-chart-muted-text">for Sane and Useful Color Strategies</span>
          </h1>
          <p className="mt-1.5 max-w-[72ch] text-sm text-chart-muted-text">
            Pick a chart type and the number of data points — get an audited palette with matched dash, decal, and
            shape encodings.
            <span className="ml-2 inline-flex items-center rounded-full border border-chart-grid bg-chart-surface px-2 py-0.5 align-middle text-[11px] tabular-nums text-chart-muted-text">
              v{PALETTE_VERSION}
            </span>
          </p>
        </header>

        <section id="flow-build" className="scroll-mt-20 panel p-4 space-y-4">
          <div id="flow-choose" className="scroll-mt-20 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-chart-axis">Palette builder</h2>
            {family === "categorical" ? (
              <span className="text-[11px] text-chart-positive-text">
                Constrained mode · default N clears every configured floor; the audit flags any N that doesn't
              </span>
            ) : !audit.bgPass ? (
              <span className="text-[11px] text-chart-negative-text">
                Ramp · WCAG contrast {audit.worstContrastVsBg.toFixed(2)}:1 fails (≥ 3:1 required) — see Verify panel
              </span>
            ) : audit.overall === "warn" ? (
              <span className="text-[11px] text-chart-target">
                Ramp · marginal at current N — see Verify panel
              </span>
            ) : (
              <span className="text-[11px] text-chart-positive-text">
                Ramp · passes WCAG contrast at current N
              </span>
            )}
          </div>

          <div className={!compare ? "grid gap-6 lg:grid-cols-[minmax(560px,1.6fr)_minmax(320px,1fr)] lg:items-start" : ""}>
            {!compare && (
              <div className="lg:sticky lg:top-14 space-y-3">
                <ChartCard
                  title={`${CHART_KIND_LABEL[kind]} — ${family} palette${vision !== "normal" ? ` · preview as ${vision}` : ""}`}
                >
                  <div style={{ filter: VISION_FILTER[vision] }}>
                    {/* The chart flexes so the verdict below it is always on
                        screen. At a 720px viewport the budget after the 48px
                        bar and padding is 656px; a fixed 560px chart plus the
                        toggle plus the verdict came to ~740px and pushed the
                        verdict out of view, which defeats pinning it at all. */}
                    <EChart option={option} height="clamp(300px, calc(100dvh - 260px), 560px)" />
                  </div>
                </ChartCard>
                <div data-tour="vision-preview">
                  <VisionPreviewToggle value={vision} onChange={setVision} />
                </div>
                <PaletteRuleExplainer kind={kind} n={n} requestedN={requestedN} />
              </div>
            )}
          <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">

            <label className="flex flex-col gap-1" data-tour="chart-kind">
              <span className="text-chart-axis text-xs">Chart type</span>
              <select
                value={kind}
                onChange={(e) => applyPrimaryBuilder({ kind: e.target.value as ChartKind })}
                className="field-select min-w-[220px]"
              >
                {(Object.keys(CHART_KIND_LABEL) as ChartKind[]).map((k) => (
                  <option key={k} value={k}>
                    {CHART_KIND_LABEL[k]} — {BEST_PRACTICE[k].family}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1" data-tour="n-slider">
              <span className="text-chart-axis text-xs">
                {family === "categorical" ? "Data points / series" : "Ramp steps"}
              </span>
              <NSlider
                min={minN}
                max={sliderMaxA}
                safe={safeBuiltinMaxA}
                committedValue={requestedN}
                onCommit={(v) => applyPrimaryBuilder({ n: v })}
                title={`Range ${minN}–${sliderMaxA} for ${CHART_KIND_LABEL[kind]} (${theme} theme). Safe-by-construction up to N=${safeBuiltinMaxA}; values above expose contrast/ΔE/CVD warnings in the audit panel.`}
                overflowLabel={
                  overflow
                    ? `N=${n} exceeds the solver-safe cap of ${safeBuiltinMaxA} for this theme/posture. The audit panel below shows which constraints were relaxed.`
                    : null
                }
              />
            </label>
            <Toggle
              label="Theme"
              value={theme}
              options={["light", "dark"] as const}
              onChange={(v) => applyPrimaryBuilder({ theme: v })}
            />
            <Toggle
              label="Preview as"
              value={vision}
              options={["normal", "deutan", "protan", "tritan", "achromatopsia"] as const}
              onChange={(v) => setVision(v)}
            />
            <Toggle
              label="Fixtures"
              value={dataMode}
              options={["synthetic", "messy"] as const}
              onChange={(v) => setDataMode(v)}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="tap-target"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
              />
              <span className="text-chart-axis">
                Compare side-by-side
                <span className="opacity-80">
                  {" "}
                  ({vision === "normal" ? "config A vs. config B" : `normal vs. ${vision}`})
                </span>
              </span>
            </label>
            <label className="ml-auto flex items-center gap-2">
              <input
                type="checkbox"
                className="tap-target"
                checked={diffOverlay}
                onChange={(e) => setDiffOverlay(e.target.checked)}
                disabled={vision === "normal" || !compare}
              />
              <span className={vision === "normal" || !compare ? "text-chart-axis opacity-50" : "text-chart-axis"}>
                Difference overlay
              </span>
            </label>
            </div>

          {compare && vision === "normal" && (

            <div className="rounded-md border border-chart-grid bg-chart-bg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-wide text-chart-axis">
                  Variant B (compared against config above)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    applyVariantB({ kind: "bar", n: BEST_PRACTICE.bar.recommendedN, theme: "dark" });
                  }}
                  className="text-xs px-2 py-1 rounded border border-chart-grid bg-chart-surface text-foreground hover:bg-chart-grid/30"
                  title="Restore Variant B to defaults: bar · N=5 · dark"
                >
                  Reset Variant B
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-chart-axis text-xs">Chart type</span>
                  <select
                    value={kindB}
                    onChange={(e) => applyVariantB({ kind: e.target.value as ChartKind })}
                    className="field-select min-w-[220px]"
                  >
                    {(Object.keys(CHART_KIND_LABEL) as ChartKind[]).map((k) => (
                      <option key={k} value={k}>
                        {CHART_KIND_LABEL[k]} — {BEST_PRACTICE[k].family}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-chart-axis text-xs">
                    {ruleB.family === "categorical" ? "Data points / series" : "Ramp steps"}
                  </span>
                  <NSlider
                    min={minNB}
                    max={sliderMaxB}
                    safe={safeBuiltinMaxB}
                    committedValue={requestedNB}
                    onCommit={(v) => applyVariantB({ n: v })}
                    title={`Range ${minNB}–${sliderMaxB} for ${CHART_KIND_LABEL[kindB]} (${themeB} theme). Safe-by-construction up to N=${safeBuiltinMaxB}; values above expose warnings in the audit panel.`}
                    overflowLabel={
                      ruleB.family === "categorical" && nB > safeBuiltinMaxB
                        ? `N=${nB} exceeds the solver-safe cap of ${safeBuiltinMaxB}.`
                        : null
                    }
                  />
                </label>
                <Toggle
                  label="Theme"
                  value={themeB}
                  options={["light", "dark"] as const}
                  onChange={(v) => applyVariantB({ theme: v })}
                />
              </div>
            </div>
          )}
          <div className="text-xs text-chart-axis space-y-1">
            <div>
              Auto-selected: posture <span className="text-foreground">{posture}</span> · family{" "}
              <span className="text-foreground">{family}</span> · rendering{" "}
              <span className="text-foreground">N={n}</span>
              {overflow && (
                <span className="text-chart-negative-text"> (capped from {requestedN} — collapsed into Top-{n} + Other)</span>
              )}
            </div>
            {warning && <div className="text-chart-negative-text">⚠ {warning}</div>}
          </div>
          <TokenPreview tokens={chartTheme.tokens} theme={theme} />
          <PaletteSwatches theme={chartTheme} family={family} steps={n} />

          {compare && vision !== "normal" && (
            <DiffOverlay colors={auditedColors} vision={vision} family={family} />
          )}

          {/* EVIDENCE — proof for a reviewer. The person actively building is
              served by the pinned PaletteVerdict, not by this section. */}
          <Evidence>
            {family !== "categorical" && (
              <div className="rounded border border-chart-grid/50 bg-chart-grid/5 px-3 py-2 text-[11px] text-chart-axis">
                <span className="font-medium text-foreground">Ramp audit scope:</span> the chart renders {n} discrete piecewise bins,
                one per audited ramp stop — every color on screen is a color the metrics below cover.
              </div>
            )}
            <LazyMount minHeight={260}>
              <VisionMatrix option={option as Record<string, unknown>} />
            </LazyMount>
            {family === "categorical" && (
              <>
                <ContrastReport theme={chartTheme} requestedN={n} />
                <SemanticRoleAudit theme={chartTheme} />
                <LazyMount minHeight={220}>
                  <DensityPreview theme={chartTheme} />
                </LazyMount>
              </>
            )}
            <SystemAudit hasManualOverrides={manualOverrides} kind={kind} theme={theme} />
            {family === "categorical" && (
              <BenchmarkPanel ours={auditedColors} background={chartTheme.tokens.bg} />
            )}
            <NextStageButton current="evidence" />
          </Evidence>

          {family === "categorical" && (
            <Storytell>
              <InsightCallouts colors={auditedColors} background={chartTheme.tokens.bg} />
              <LazyMount minHeight={340}>
                <EmphasisPreview theme={chartTheme} kind={kind} />
              </LazyMount>
              <NextStageButton current="storytell" />
            </Storytell>
          )}

          <Reuse>
            <PalettePresets
              current={{ kind, n, theme }}
              onApply={(p) => applyPrimaryBuilder({ kind: p.kind, n: p.n, theme: p.theme })}
            />
            <WorkflowPresets
              current={{
                kind,
                n: requestedN,
                theme,
                vision,
                dataMode,
                compare,
                kindB,
                nB: requestedNB,
                themeB,
              } satisfies WorkflowState}
              onApply={(p) => {
                applyPrimaryBuilder({ kind: p.kind, n: p.n, theme: p.theme });
                setVision(p.vision);
                setDataMode(p.dataMode);
                setCompare(p.compare);
                applyVariantB({ kind: p.kindB, n: p.nB, theme: p.themeB });
              }}
            />
            {family === "categorical" && (
              <EntityPins
                entities={SERIES_NAMES.slice(0, chartTheme.effectiveN)}
                n={chartTheme.effectiveN}
                colorHexes={chartTheme.colorHexes}
                onChange={() => setPinRev((r) => r + 1)}
              />
            )}
            <NextStageButton current="reuse" />
          </Reuse>

          <Ship>
          {family === "categorical" && <CodeSnippet kind={kind} n={n} theme={chartTheme} />}
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-chart-grid bg-chart-bg p-3">
            <span className="text-[10px] uppercase tracking-wide text-chart-axis mr-2">Ship</span>
            <button
              type="button"
              data-tour="export-palette"
              onClick={() => setExportOpen(true)}
              className="rounded-md border border-chart-grid bg-chart-positive-strong text-chart-bg px-3 py-1 text-xs font-medium hover:opacity-90"
              title="Export the current palette as CSS variables, Tailwind config, ECharts theme, Figma Tokens, or an SVG swatch sheet."
            >
              Export palette
            </button>
            <button
              type="button"
              onClick={() =>
                exportComparisonReport({
                  kind,
                  family,
                  posture,
                  theme,
                  vision,
                  n,
                  requestedN,
                  rule,
                  option,
                  warnings,
                  audit,
                  auditedColors,
                  background: chartTheme.tokens.bg,
                  paletteVersion: PALETTE_VERSION,
                  variantB:
                    compare && vision === "normal"
                      ? {
                          kind: kindB,
                          family: ruleB.family,
                          posture: ruleB.posture,
                          theme: themeB,
                          n: nB,
                          requestedN: requestedNB,
                          rule: ruleB,
                          option: optionB,
                          warnings: warningsB,
                          audit: auditB,
                          auditedColors: auditedColorsB,
                          background: chartThemeB.tokens.bg,
                        }
                      : undefined,
                })
              }
              className="rounded-md border border-chart-grid bg-chart-info-strong text-chart-bg px-3 py-1 text-xs font-medium hover:opacity-90"
              title="Open a self-contained HTML audit report (both charts, warnings, accessibility metrics). Use your browser's Print → Save as PDF to export."
            >
              Export audit report
            </button>
            <ShareLink state={urlState} />
          </div>
          <NextStageButton current="ship" />
          </Ship>
          </div>
        </div>
        </section>


        <div className="flex flex-wrap items-center gap-2">
          <OptimalOnlyBadge
            hasManualOverrides={manualOverrides}
            safeCapA={safeBuiltinMaxA}
            recommendedA={rule.recommendedN}
            safeCapB={compare ? safeBuiltinMaxB : undefined}
            recommendedB={compare ? ruleB.recommendedN : undefined}
            compare={compare}
          />
        </div>

        {compare && vision !== "normal" ? (
          <>
            <LinkedCompareCharts
              option={option}
              kind={kind}
              vision={vision}
              visionFilter={VISION_FILTER[vision]}
              auditedColors={auditedColors}
              family={family}
              diffOverlay={diffOverlay}
            />
            <SeriesScorecard
              colors={auditedColors}
              vision={vision}
              background={chartTheme.tokens.bg}
            />
          </>
        ) : compare ? (
          <>
            <LinkedCompareCharts
              option={option}
              optionB={optionB}
              kind={kind}
              kindB={kindB}
              nB={nB}
              themeB={themeB}
              vision="normal"
              visionFilter="none"
              auditedColors={auditedColors}
              family={family}
              diffOverlay={false}
            />
            <DiffSummary
              a={{ kind, n, requestedN, overflow, theme, recommendedN: rule.recommendedN, maxN: rule.maxN }}
              b={{ kind: kindB, n: nB, requestedN: requestedNB, overflow: overflowB, theme: themeB, recommendedN: ruleB.recommendedN, maxN: ruleB.maxN }}
            />
            <VariantScorecard
              a={{
                label: `A · ${CHART_KIND_LABEL[kind]}`,
                colors: auditedColors,
                background: chartTheme.tokens.bg,
              }}
              b={{
                label: `B · ${CHART_KIND_LABEL[kindB]}`,
                colors: auditedColorsB,
                background: chartThemeB.tokens.bg,
              }}
            />
          </>
        ) : null}




        {/* REFERENCE — collapsed footer: glossary + decision rationale. */}

      </div>

      <ExportPalette
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        snapshot={{
          name: `chart-palette-${kind}-n${n}-${theme}`,
          theme,
          themeA: chartTheme,
          themeB: compare && vision === "normal" ? chartThemeB : undefined,
          // Match the rendered chart: seq/div exports carry the same number
          // of stops the builder is showing; categorical kinds default to 9.
          rampSteps: family === "sequential" ? n : family === "diverging" ? Math.max(3, n) : 9,
        }}
      />
      <ReferenceDrawer
        open={referenceOpen}
        onClose={() => setReferenceOpen(false)}
        focusTerm={referenceTerm}
      >
        <ExplainPanel
          kind={kind}
          rule={rule}
          n={n}
          requestedN={requestedN}
          overflow={overflow}
          theme={theme}
          posture={posture}
          family={family}
          chartTheme={chartTheme}
          audit={audit}
          relaxations={chartTheme.solve.relaxations}
        />
      </ReferenceDrawer>
      <CoachTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
};

type DiffVariant = {
  kind: ChartKind;
  n: number;
  requestedN: number;
  overflow: boolean;
  theme: Theme;
  recommendedN: number;
  maxN: number;
};

function DiffSummary({ a, b }: { a: DiffVariant; b: DiffVariant }) {
  function variantNotes(v: DiffVariant): string[] {
    const notes: string[] = [];
    if (v.overflow) notes.push(`capped from ${v.requestedN} → ${v.n} (max ${v.maxN})`);
    if (!v.overflow && v.n > v.recommendedN) notes.push(`above recommended ${v.recommendedN}`);
    return notes;
  }
  const rows: { label: string; a: string; b: string; diff: boolean }[] = [
    {
      label: "Chart kind",
      a: CHART_KIND_LABEL[a.kind],
      b: CHART_KIND_LABEL[b.kind],
      diff: a.kind !== b.kind,
    },
    { label: "N (rendered)", a: String(a.n), b: String(b.n), diff: a.n !== b.n },
    { label: "Theme", a: a.theme, b: b.theme, diff: a.theme !== b.theme },
    {
      label: "Warnings",
      a: variantNotes(a).join("; ") || "—",
      b: variantNotes(b).join("; ") || "—",
      diff: variantNotes(a).join("|") !== variantNotes(b).join("|"),
    },
  ];
  return (
    <section className="panel p-4 space-y-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-chart-axis">
        Diff summary — Variant A vs. Variant B
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-chart-axis">
              <th className="py-1 pr-4 font-medium">Field</th>
              <th className="py-1 pr-4 font-medium">Variant A</th>
              <th className="py-1 pr-4 font-medium">Variant B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-chart-grid/50">
                <td className="py-1 pr-4 text-chart-axis">{r.label}</td>
                <td className={`py-1 pr-4 tabular-nums ${r.diff ? "text-foreground font-medium" : "text-foreground/70"}`}>
                  {r.a}
                </td>
                <td className={`py-1 pr-4 tabular-nums ${r.diff ? "text-foreground font-medium" : "text-foreground/70"}`}>
                  {r.b}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  void value;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span id={`toggle-label-${label}`} className="shrink-0 text-chart-axis">{label}</span>
      <div
        role="group"
        aria-labelledby={`toggle-label-${label}`}
        className="inline-flex max-w-full overflow-x-auto rounded-md border border-chart-grid [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {options.map((o) => {
          const selected = value === o;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o)}
              className={`px-3 py-1 text-xs transition-colors duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus ${
                selected
                  ? "bg-chart-info-strong text-chart-bg font-medium"
                  : "text-chart-axis hover:bg-chart-grid hover:text-foreground"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PaletteSwatches({
  theme,
  family,
  steps,
}: {
  theme: ReturnType<typeof getChartTheme>;
  family: "categorical" | "sequential" | "diverging";
  steps: number;
}) {
  let colors: string[];
  if (family === "categorical") colors = theme.colorHexes;
  else if (family === "sequential")
    colors = sequentialRamp(theme.tokens.seqLow, theme.tokens.seqHigh, steps).map((c) => c.hex);
  else
    colors = divergingRamp(
      theme.tokens.divNeg,
      theme.tokens.divMid,
      theme.tokens.divPos,
      Math.max(3, steps)
    ).map((c) => c.hex);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {colors.map((c, i) => (
          <div
            key={i}
            className="w-10 h-10 rounded border border-chart-grid flex items-end justify-center text-[10px] tabular-nums"
            style={{ backgroundColor: c, color: theme.tokens.bg.hex }}
            title={c}
          >
            {i}
          </div>
        ))}
      </div>
      <div className="text-[10px] text-chart-axis font-mono break-all">{colors.join(" · ")}</div>
    </div>
  );
}

/**
 * Difference overlay: per-slot ΔE between normal and the simulated vision,
 * plus pairwise collisions (slot pairs that fall below the CVD ΔE threshold
 * once simulated). Surfaces exactly which series/segments become unreadable.
 */
function computeDiff(colors: ColorRecord[], vision: VisionMode) {
  const sim = colors.map((c) => simulateColor(c, vision));
  const shifts = colors.map((c, i) => ({
    i,
    fromHex: c.hex,
    toHex: sim[i].hex,
    deltaE: deltaE(c, sim[i]),
  }));
  const threshold =
    vision === "achromatopsia" ? THRESHOLDS.minDeltaL * 100 : THRESHOLDS.minDeltaECvd;
  const collisions: Array<{ a: number; b: number; before: number; after: number }> = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const before = deltaE(colors[i], colors[j]);
      const after = deltaE(sim[i], sim[j]);
      if (after < threshold) collisions.push({ a: i, b: j, before, after });
    }
  }
  collisions.sort((x, y) => x.after - y.after);
  return { sim, shifts, collisions, threshold };
}

function DiffOverlay({
  colors,
  vision,
  family,
}: {
  colors: ColorRecord[];
  vision: VisionMode;
  family: "categorical" | "sequential" | "diverging";
}) {
  const { sim, shifts, collisions, threshold } = useMemo(
    () => computeDiff(colors, vision),
    [colors, vision]
  );
  const collidingSlots = new Set<number>();
  collisions.forEach((c) => {
    collidingSlots.add(c.a);
    collidingSlots.add(c.b);
  });

  return (
    <details
      className="rounded-md border border-chart-grid bg-chart-surface p-3 text-xs"
      open
    >
      <summary className="cursor-pointer text-chart-axis font-medium">
        Difference overlay — {vision}{" "}
        <span className="text-chart-axis">
          · {collisions.length === 0
            ? "no collisions"
            : `${collisions.length} collision${collisions.length === 1 ? "" : "s"} (ΔE < ${threshold.toFixed(0)})`}
        </span>
      </summary>

      <div className="mt-3 space-y-3">
        <div className="text-[11px] text-chart-axis">
          Each slot shows its color in normal vision (top) vs. simulated {vision} (bottom),
          and the ΔE shift. Slots that collide with another slot under {vision} are
          outlined in negative.
        </div>

        <div className="flex flex-wrap gap-2">
          {shifts.map((s) => {
            const collides = collidingSlots.has(s.i);
            return (
              <div
                key={s.i}
                className={`rounded border ${
                  collides
                    ? "border-chart-negative ring-1 ring-chart-negative"
                    : "border-chart-grid"
                } overflow-hidden text-[10px]`}
                title={`Slot ${s.i}: ${s.fromHex} → ${s.toHex} (ΔE ${s.deltaE.toFixed(1)})`}
              >
                <div className="w-12 h-5" style={{ backgroundColor: s.fromHex }} />
                <div className="w-12 h-5" style={{ backgroundColor: s.toHex }} />
                <div className="px-1 py-0.5 text-center tabular-nums text-chart-axis">
                  #{s.i} · Δ{s.deltaE.toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>

        {family === "categorical" && collisions.length > 0 && (
          <div>
            <div className="text-[11px] text-chart-axis mb-1">
              Collisions — these series become indistinguishable under {vision}:
            </div>
            <ul className="space-y-1">
              {collisions.slice(0, 10).map((c, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 text-chart-negative-text"
                >
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: sim[c.a].hex }} />
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: sim[c.b].hex }} />
                  <span className="tabular-nums">
                    #{c.a} ↔ #{c.b}: ΔE {c.before.toFixed(1)} → {c.after.toFixed(1)} (need ≥ {threshold.toFixed(0)})
                  </span>
                </li>
              ))}
              {collisions.length > 10 && (
                <li className="text-chart-axis">
                  …and {collisions.length - 10} more.
                </li>
              )}
            </ul>
          </div>
        )}

        {family !== "categorical" && (
          <div className="text-[11px] text-chart-axis">
            For {family} ramps, watch for adjacent steps whose ΔE shift collapses
            the perceived gradient — flagged steps above lose ordering cues.
          </div>
        )}
      </div>
    </details>
  );
}

/**
 * Per-series readability scorecard. For each slot, computes:
 *  - Contrast vs. background under normal vs. simulated vision (WCAG 2.2 SC 1.4.11; ≥ 3:1).
 *  - Worst pairwise ΔE vs. all other slots, normal vs. simulated (CVD threshold).
 * Renders a side-by-side table so the user can spot exactly which series degrade.
 */
function SeriesScorecard({
  colors,
  vision,
  background,
}: {
  colors: ColorRecord[];
  vision: VisionMode;
  background: ColorRecord;
}) {
  const rows = useMemo(() => {
    const sim = colors.map((c) => simulateColor(c, vision));
    const cvdThreshold =
      vision === "achromatopsia" ? THRESHOLDS.minDeltaL * 100 : THRESHOLDS.minDeltaECvd;
    return colors.map((c, i) => {
      let worstNormal = Infinity;
      let worstSim = Infinity;
      for (let j = 0; j < colors.length; j++) {
        if (j === i) continue;
        worstNormal = Math.min(worstNormal, deltaE(c, colors[j]));
        worstSim = Math.min(worstSim, deltaE(sim[i], sim[j]));
      }
      const cNormal = contrastRatio(c, background);
      const cSim = contrastRatio(sim[i], background);
      return {
        i,
        normalHex: c.hex,
        simHex: sim[i].hex,
        contrastNormal: cNormal,
        contrastSim: cSim,
        contrastNormalPass: cNormal >= 3,
        contrastSimPass: cSim >= 3,
        deltaNormal: colors.length < 2 ? Infinity : worstNormal,
        deltaSim: colors.length < 2 ? Infinity : worstSim,
        deltaNormalPass: colors.length < 2 || worstNormal >= THRESHOLDS.minDeltaENormal,
        deltaSimPass: colors.length < 2 || worstSim >= cvdThreshold,
        cvdThreshold,
      };
    });
  }, [colors, vision, background]);

  const cell = (pass: boolean) =>
    pass ? "text-chart-positive-text" : "text-chart-negative-text font-medium";

  return (
    <div className="panel p-4 text-xs">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium text-chart-axis">
          Per-series readability — normal vs. {vision}
        </h3>
        <div className="text-[10px] text-chart-axis">
          contrast ≥ 3:1 (WCAG 2.2 SC 1.4.11) · ΔE ≥ {THRESHOLDS.minDeltaENormal} normal /{" "}
          {rows[0]?.cvdThreshold.toFixed(0) ?? "—"} {vision}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <thead className="text-chart-axis">
            <tr className="border-b border-chart-grid">
              <th className="py-1 pr-2">Slot</th>
              <th className="py-1 pr-2" colSpan={2}>Color</th>
              <th className="py-1 pr-2" colSpan={2}>Contrast vs. bg</th>
              <th className="py-1 pr-2" colSpan={2}>Worst ΔE vs. others</th>
              <th className="py-1 pr-2">Verdict</th>
            </tr>
            <tr className="text-[10px] text-chart-axis">
              <th></th>
              <th className="pr-2">normal</th>
              <th className="pr-2">{vision}</th>
              <th className="pr-2">normal</th>
              <th className="pr-2">{vision}</th>
              <th className="pr-2">normal</th>
              <th className="pr-2">{vision}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const allPass =
                r.contrastNormalPass && r.contrastSimPass && r.deltaNormalPass && r.deltaSimPass;
              const degraded =
                (r.contrastNormalPass && !r.contrastSimPass) ||
                (r.deltaNormalPass && !r.deltaSimPass);
              return (
                <tr key={r.i} className="border-b border-chart-grid/40">
                  <td className="py-1 pr-2 text-chart-axis">#{r.i}</td>
                  <td className="py-1 pr-2">
                    <span
                      className="inline-block w-5 h-5 rounded-sm border border-chart-grid"
                      style={{ backgroundColor: r.normalHex }}
                      title={r.normalHex}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <span
                      className="inline-block w-5 h-5 rounded-sm border border-chart-grid"
                      style={{ backgroundColor: r.simHex }}
                      title={r.simHex}
                    />
                  </td>
                  <td className={`py-1 pr-2 ${cell(r.contrastNormalPass)}`}>
                    {r.contrastNormal.toFixed(2)}:1
                  </td>
                  <td className={`py-1 pr-2 ${cell(r.contrastSimPass)}`}>
                    {r.contrastSim.toFixed(2)}:1
                  </td>
                  <td className={`py-1 pr-2 ${cell(r.deltaNormalPass)}`}>
                    {Number.isFinite(r.deltaNormal) ? r.deltaNormal.toFixed(1) : "—"}
                  </td>
                  <td className={`py-1 pr-2 ${cell(r.deltaSimPass)}`}>
                    {Number.isFinite(r.deltaSim) ? r.deltaSim.toFixed(1) : "—"}
                  </td>
                  <td className="py-1 pr-2">
                    {allPass ? (
                      <span className="text-chart-positive-text">✓ pass</span>
                    ) : degraded ? (
                      <span className="text-chart-negative-text">⚠ degrades under {vision}</span>
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
    </div>
  );
}

interface VariantInput {
  label: string;
  colors: ColorRecord[];
  background: ColorRecord;
}

function variantRows(colors: ColorRecord[], background: ColorRecord) {
  return colors.map((c, i) => {
    let worst = Infinity;
    for (let j = 0; j < colors.length; j++) {
      if (j === i) continue;
      worst = Math.min(worst, deltaE(c, colors[j]));
    }
    const contrast = contrastRatio(c, background);
    return {
      i,
      hex: c.hex,
      contrast,
      contrastPass: contrast >= 3,
      delta: colors.length < 2 ? Infinity : worst,
      deltaPass: colors.length < 2 || worst >= THRESHOLDS.minDeltaENormal,
    };
  });
}

/**
 * Side-by-side readability scorecard for two variants (Compare mode in normal vision).
 * Per-variant rows: slot swatch, contrast vs. its own background, worst ΔE vs. other
 * slots in the same palette, verdict. Used when comparing A vs. B configurations.
 */
function VariantScorecard({ a, b }: { a: VariantInput; b: VariantInput }) {
  const rowsA = useMemo(() => variantRows(a.colors, a.background), [a.colors, a.background]);
  const rowsB = useMemo(() => variantRows(b.colors, b.background), [b.colors, b.background]);
  const cell = (pass: boolean) =>
    pass ? "text-chart-positive-text" : "text-chart-negative-text font-medium";

  const renderTable = (label: string, rows: ReturnType<typeof variantRows>) => (
    <div className="min-w-0">
      <div className="text-xs font-medium text-chart-axis mb-2 truncate" title={label}>
        {label}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left tabular-nums text-xs">
          <thead className="text-chart-axis">
            <tr className="border-b border-chart-grid">
              <th className="py-1 pr-2">Slot</th>
              <th className="py-1 pr-2">Color</th>
              <th className="py-1 pr-2">Contrast</th>
              <th className="py-1 pr-2">Worst ΔE</th>
              <th className="py-1 pr-2">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pass = r.contrastPass && r.deltaPass;
              return (
                <tr key={r.i} className="border-b border-chart-grid/40">
                  <td className="py-1 pr-2 text-chart-axis">#{r.i}</td>
                  <td className="py-1 pr-2">
                    <span
                      className="inline-block w-5 h-5 rounded-sm border border-chart-grid"
                      style={{ backgroundColor: r.hex }}
                      title={r.hex}
                    />
                  </td>
                  <td className={`py-1 pr-2 ${cell(r.contrastPass)}`}>
                    {r.contrast.toFixed(2)}:1
                  </td>
                  <td className={`py-1 pr-2 ${cell(r.deltaPass)}`}>
                    {Number.isFinite(r.delta) ? r.delta.toFixed(1) : "—"}
                  </td>
                  <td className="py-1 pr-2">
                    {pass ? (
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
    </div>
  );

  return (
    <div className="panel p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium text-chart-axis">
          Per-series readability — Variant A vs. Variant B
        </h3>
        <div className="text-[10px] text-chart-axis">
          contrast ≥ 3:1 (WCAG 2.2 SC 1.4.11) · ΔE ≥ {THRESHOLDS.minDeltaENormal}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderTable(a.label, rowsA)}
        {renderTable(b.label, rowsB)}
      </div>
    </div>
  );
}

function DiffOverlayBadge({
  colors,
  vision,
  family,
}: {
  colors: ColorRecord[];
  vision: VisionMode;
  family: "categorical" | "sequential" | "diverging";
}) {
  const { collisions, threshold } = useMemo(
    () => computeDiff(colors, vision),
    [colors, vision]
  );
  void family;
  if (collisions.length === 0) {
    return (
      <div className="absolute top-2 right-2 rounded-md bg-chart-surface/90 border border-chart-grid px-2 py-1 text-[10px] text-chart-positive-text">
        ✓ No collisions under {vision}
      </div>
    );
  }
  return (
    <div className="absolute top-2 right-2 max-w-[60%] rounded-md bg-chart-surface/95 border border-chart-negative px-2 py-1 text-[10px] text-chart-negative-text">
      <div className="font-medium">⚠ {collisions.length} unreadable pair{collisions.length === 1 ? "" : "s"} (ΔE &lt; {threshold.toFixed(0)})</div>
      <div className="mt-0.5 text-chart-axis">
        {collisions.slice(0, 3).map((c) => `#${c.a}↔#${c.b}`).join(" · ")}
        {collisions.length > 3 && ` · +${collisions.length - 3}`}
      </div>
    </div>
  );
}


function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <h3 className="text-sm font-medium text-chart-axis mb-2">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Renders the normal-vision and simulated-vision charts side-by-side and
 * mirrors hover state. When the user hovers a series/data point in either
 * chart, ECharts' `highlight` action is dispatched on the matching item of
 * the other chart, and `downplay` is dispatched on mouseout. Both charts
 * render the same `option`, so seriesIndex/dataIndex map 1:1.
 */
function LinkedCompareCharts({
  option,
  optionB,
  kind,
  kindB,
  nB,
  themeB,
  vision,
  visionFilter,
  auditedColors,
  family,
  diffOverlay,
}: {
  option: Record<string, unknown>;
  /** When provided, the right pane renders this independent option (Variant B
   * mode); otherwise it renders `option` again with the vision filter (CVD
   * preview mode). */
  optionB?: Record<string, unknown>;
  kind: ChartKind;
  kindB?: ChartKind;
  nB?: number;
  themeB?: Theme;
  vision: VisionMode;
  visionFilter: string;
  auditedColors: ColorRecord[];
  family: "categorical" | "sequential" | "diverging";
  diffOverlay: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bRef = useRef<any>(null);
  const suppressRef = useRef(false);

  const makeHandlers = (peerRef: { current: unknown }) => ({
    mouseover: (params: unknown) => {
      if (suppressRef.current) return;
      const p = params as { seriesIndex?: number; dataIndex?: number };
      const peer = peerRef.current as { dispatchAction?: (a: unknown) => void } | null;
      if (!peer?.dispatchAction) return;
      suppressRef.current = true;
      peer.dispatchAction({
        type: "highlight",
        seriesIndex: p.seriesIndex,
        dataIndex: p.dataIndex,
      });
      requestAnimationFrame(() => {
        suppressRef.current = false;
      });
    },
    mouseout: (params: unknown) => {
      if (suppressRef.current) return;
      const p = params as { seriesIndex?: number; dataIndex?: number };
      const peer = peerRef.current as { dispatchAction?: (a: unknown) => void } | null;
      if (!peer?.dispatchAction) return;
      suppressRef.current = true;
      peer.dispatchAction({
        type: "downplay",
        seriesIndex: p.seriesIndex,
        dataIndex: p.dataIndex,
      });
      requestAnimationFrame(() => {
        suppressRef.current = false;
      });
    },
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const aHandlers = useMemo(() => makeHandlers(bRef), [option, optionB, vision]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bHandlers = useMemo(() => makeHandlers(aRef), [option, optionB, vision]);

  const isVariantBMode = optionB !== undefined;
  const leftTitle = isVariantBMode
    ? `Variant A — ${CHART_KIND_LABEL[kind]}`
    : `${CHART_KIND_LABEL[kind]} — normal vision`;
  const rightTitle = isVariantBMode
    ? `Variant B — ${CHART_KIND_LABEL[kindB ?? kind]}${nB !== undefined ? ` · N=${nB}` : ""}${themeB ? ` · ${themeB}` : ""}`
    : `${CHART_KIND_LABEL[kind]} — preview as ${vision}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title={leftTitle}>
        <EChart
          option={option}
          height={460}
          onReady={(c) => {
            aRef.current = c;
          }}
          onEvents={aHandlers}
        />
      </ChartCard>
      <ChartCard title={rightTitle}>
        <div className="relative">
          <div style={{ filter: isVariantBMode ? "none" : visionFilter }}>
            <EChart
              option={optionB ?? option}
              height={460}
              onReady={(c) => {
                bRef.current = c;
              }}
              onEvents={bHandlers}
            />
          </div>
          {diffOverlay && !isVariantBMode && (
            <DiffOverlayBadge colors={auditedColors} vision={vision} family={family} />
          )}
        </div>
      </ChartCard>
    </div>
  );
}

function KpiTile({ theme }: { theme: ReturnType<typeof getChartTheme> }) {
  const value = 1284;
  const delta = 12.4;
  const positive = delta >= 0;
  return (
    <div className="panel p-6 flex flex-col justify-between min-h-[200px]">
      <div className="text-xs uppercase tracking-wide text-chart-axis">Monthly active users</div>
      <div className="text-5xl font-semibold tabular-nums" style={{ color: theme.tokens.target.hex }}>
        {value.toLocaleString()}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span style={{ color: positive ? theme.tokens.positive.hex : theme.tokens.negative.hex }}>
          {positive ? "▲" : "▼"} {Math.abs(delta)}%
        </span>
        <span className="text-chart-axis">vs. last month</span>
      </div>
    </div>
  );
}

function ContrastReport({
  theme,
  requestedN,
}: {
  theme: ReturnType<typeof getChartTheme>;
  requestedN: number;
}) {
  const { solve, effectiveN, overflow } = theme;
  const passNormal = solve.minPairDeltaE >= THRESHOLDS.minDeltaENormal;
  const passCvd = solve.minCvdDeltaE >= THRESHOLDS.minDeltaECvd;
  return (
    <div className="text-xs space-y-2">
      <div className="flex flex-wrap gap-3">
        {theme.colorHexes.map((c, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1 rounded border border-chart-grid">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: c }} />
            <span className="text-chart-axis">slot {i}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-chart-axis">
        <Metric label="Effective N" value={`${effectiveN}${overflow ? ` (+Other from ${requestedN})` : ""}`} />
        <Metric
          label="min ΔE (normal)"
          value={solve.minPairDeltaE === Infinity ? "n/a" : solve.minPairDeltaE.toFixed(1)}
          ok={passNormal}
        />
        <Metric
          label="min ΔE (worst CVD)"
          value={solve.minCvdDeltaE === Infinity ? "n/a" : solve.minCvdDeltaE.toFixed(1)}
          ok={passCvd}
        />
        <Metric
          label="Relaxations"
          value={solve.relaxations.length === 0 ? "none" : solve.relaxations.join(", ")}
          ok={solve.relaxations.length === 0}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded border border-chart-grid p-2">
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className={`tabular-nums ${ok === false ? "text-chart-negative-text" : ok ? "text-chart-positive-text" : ""}`}>
        {value}
      </div>
    </div>
  );
}


function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(v.slice(0, 2), 16) / 255,
    g: parseInt(v.slice(2, 4), 16) / 255,
    b: parseInt(v.slice(4, 6), 16) / 255,
  };
}

function ExplainPanel({
  kind,
  rule,
  n,
  requestedN,
  overflow,
  theme,
  posture,
  family,
  chartTheme,
  audit,
  relaxations,
}: {
  kind: ChartKind;
  rule: (typeof BEST_PRACTICE)[ChartKind];
  n: number;
  requestedN: number;
  overflow: boolean;
  theme: Theme;
  posture: string;
  family: "categorical" | "sequential" | "diverging";
  chartTheme: ReturnType<typeof getChartTheme>;
  audit: AuditReport;
  relaxations: string[];
}) {
  const familyExplanation =
    family === "categorical"
      ? `Distinct entities with no inherent order, so we use a categorical palette: every slot is maximally separated in OKLab and paired 1:1 with a dash, decal, and marker shape so meaning survives color loss.`
      : family === "sequential"
      ? `Ordered, single-direction magnitude (low → high), so we use a sequential ramp from --chart-seq-low to --chart-seq-high. Lightness is monotonic by construction — the ramp still reads correctly in grayscale.`
      : `Signed magnitude around a meaningful midpoint, so we use a diverging ramp: --chart-div-neg → --chart-div-mid → --chart-div-pos with matched ΔL on each arm so neither side dominates.`;

  const postureExplanation =
    posture === "kpi"
      ? `KPI posture — low chroma, very few slots. The palette stays out of the way so the number is the hero.`
      : posture === "comparative"
      ? `Comparative posture — medium chroma, mid range of slots. Tuned for side-by-side reading where every series matters.`
      : `Exploratory posture — high chroma, more slots allowed. Tuned for ad-hoc analysis where users are scanning for outliers.`;

  const rampNote =
    family === "sequential"
      ? `${n}-step ramp interpolated in OKLCH with the shortest hue arc; gamut-mapped by reducing chroma until each step lands inside sRGB.`
      : family === "diverging"
      ? `${Math.max(3, n)}-step ramp; we force an odd count when possible so the neutral midpoint sits on a step rather than between two.`
      : `Solver: seeded farthest-point traversal under worst-of-three CVD ΔE, then ${chartTheme.solve.relaxations.length === 0 ? "simulated annealing converged with no relaxations" : `simulated annealing with relaxations on ${chartTheme.solve.relaxations.join(", ")}`}.`;

  const a11ySummary = (() => {
    const bgPart = audit.bgPass
      ? `WCAG 2.2 SC 1.4.11 contrast vs. background passes (worst ${audit.worstContrastVsBg.toFixed(2)}:1, threshold 3:1).`
      : `WCAG 2.2 SC 1.4.11 contrast vs. background **fails** (worst ${audit.worstContrastVsBg.toFixed(2)}:1, need ≥ 3:1).`;
    let visionPart: string;
    if (family !== "categorical") {
      // Pairwise ΔE separation is not a meaningful metric for gradient ramps —
      // adjacent stops are intentionally close. Only WCAG contrast is audited.
      visionPart = `Pairwise ΔE not applicable for ${family} ramps — gradient stops are designed to be perceptually adjacent. WCAG contrast is the primary accessibility metric.`;
    } else {
      const failing = audit.perVision.filter((v) => !v.pass);
      visionPart =
        failing.length === 0
          ? `All five vision modes (normal + deutan + protan + tritan + achromatopsia) clear their ΔE thresholds.`
          : `These vision modes do not clear thresholds: ${failing.map((v) => `${v.mode} (${v.mode === "achromatopsia" ? "ΔL" : "ΔE"} ${v.minDeltaE.toFixed(1)} < ${v.threshold < 1 ? v.threshold.toFixed(1) : v.threshold.toFixed(0)})`).join(", ")}.`;
    }
    return `${visionPart} ${bgPart}`;
  })();

  const rationaleText = [
    `Chart palette — ${CHART_KIND_LABEL[kind]} · family ${family} · posture ${posture} · theme ${theme} · N=${n} (requested ${requestedN}${overflow ? `, capped` : ""}).`,
    `Why this family: ${familyExplanation}`,
    `Why this posture: ${postureExplanation}`,
    `Why this N: recommended ≤ ${rule.recommendedN}, hard cap ${rule.maxN}. ${rule.rationale}`,
    `${family === "categorical" ? "Solver" : "Ramp"}: ${rampNote}`,
    relaxations.length > 0 ? `Relaxations applied: ${relaxations.join(", ")} — tighten by lowering N.` : `No relaxations applied.`,
    `Accessibility: ${a11ySummary}`,
    `Verdict: ${audit.overall.toUpperCase()} — ${
      audit.overall === "pass"
        ? "ship it."
        : audit.overall === "warn"
        ? family === "categorical"
          ? "usable, but consider lowering N or switching chart type."
          : "usable, but WCAG contrast is marginal — consider adjusting the ramp CSS token."
        : family === "categorical"
        ? "do not ship at this N — lower N or pick a different chart type."
        : "do not ship — WCAG contrast fails against the background. Adjust the ramp CSS token color (--chart-seq-low / --chart-seq-high for sequential, --chart-div-* for diverging) until the worst stop clears 3:1."
    }`,
  ].join("\n\n");

  return (
    <details className="rounded border border-chart-grid p-3 text-xs" open>
      <summary className="cursor-pointer text-xs uppercase tracking-wide text-chart-axis hover:text-foreground flex items-center justify-between gap-2">
        <span>Explain this palette</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            navigator.clipboard.writeText(rationaleText).then(
              () => toast({ title: "Rationale copied", description: "Paste it into a PR, ticket, or design spec." }),
              () => toast({ title: "Copy failed", description: "Clipboard access was denied." })
            );
          }}
          className="tap-target text-[10px] normal-case tracking-normal rounded border border-chart-grid bg-chart-bg px-2 py-0.5 text-foreground hover:bg-chart-grid/30"
          title="Copy a paragraph-formatted decision rationale to the clipboard"
        >
          Copy rationale
        </button>
      </summary>
      <div className="mt-3 space-y-3 text-foreground/90">
        <Row label="Inputs (you)">
          Chart type <strong>{CHART_KIND_LABEL[kind]}</strong>, requested N <strong>{requestedN}</strong>, theme{" "}
          <strong>{theme}</strong>.
        </Row>
        <Row label="Family (auto)">
          <strong className="capitalize">{family}</strong>. {familyExplanation}
        </Row>
        <Row label="Posture (auto)">
          <strong className="capitalize">{posture}</strong>. {postureExplanation}
        </Row>
        <Row label="N (clamped)">
          Rendering <strong>N={n}</strong>. Recommended ≤ {rule.recommendedN}, hard cap {rule.maxN}.{" "}
          {overflow
            ? `You requested ${requestedN}; we collapsed everything past slot ${n} into "Other" because past the cap the palette can't stay readable.`
            : `Within the recommended range — no overflow needed.`}
        </Row>
        <Row label="Why this rule">{rule.rationale}</Row>
        <Row label={family === "categorical" ? "Solver" : "Ramp"}>{rampNote}</Row>
        {relaxations.length > 0 && (
          <Row label="Relaxations applied">
            {relaxations.join(", ")} — the constraint was loosened to keep the palette feasible at this N. Tighten by
            lowering N.
          </Row>
        )}
        <Row label="Accessibility">{a11ySummary}</Row>
        <Row label="Verdict">
          <span
            className={
              audit.overall === "pass"
                ? "text-chart-positive-text"
                : audit.overall === "warn"
                ? "text-chart-target"
                : "text-chart-negative-text"
            }
          >
            {audit.overall.toUpperCase()}
          </span>{" "}
          — {audit.overall === "pass"
            ? "ship it."
            : audit.overall === "warn"
            ? family === "categorical"
              ? "usable, but consider lowering N or switching chart type."
              : "usable, but WCAG contrast is marginal — adjust the ramp CSS token."
            : family === "categorical"
            ? "do not ship at this N — lower N or pick a different chart type."
            : "do not ship — WCAG contrast fails. Adjust the ramp CSS token (--chart-seq-low / --chart-seq-high for sequential, --chart-div-* for diverging) until the worst stop clears 3:1."}
        </Row>
      </div>
    </details>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <div className="text-[10px] uppercase tracking-wide text-chart-axis pt-0.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function WarningList({
  warnings,
}: {
  warnings: Array<{ severity: "error" | "warn" | "info"; title: string; detail: string }>;
}) {
  if (warnings.length === 0) {
    return (
      <div className="rounded border border-chart-positive/40 bg-chart-positive/5 p-3 text-xs text-chart-positive-text flex items-center gap-2">
        <span aria-hidden>✓</span>
        <span>No warnings — palette satisfies every best-practice and accessibility check.</span>
      </div>
    );
  }
  const order = { error: 0, warn: 1, info: 2 } as const;
  const sorted = [...warnings].sort((a, b) => order[a.severity] - order[b.severity]);
  const counts = sorted.reduce(
    (acc, w) => ({ ...acc, [w.severity]: (acc[w.severity] ?? 0) + 1 }),
    {} as Record<string, number>
  );
  const tone = (s: "error" | "warn" | "info") =>
    s === "error"
      ? { border: "border-chart-negative/50", bg: "bg-chart-negative/10", text: "text-chart-negative-text", icon: "✕" }
      : s === "warn"
      ? { border: "border-chart-target/50", bg: "bg-chart-target/10", text: "text-chart-target", icon: "⚠" }
      : { border: "border-chart-grid", bg: "bg-chart-surface", text: "text-chart-axis", icon: "ℹ" };

  return (
    <div className="space-y-2" role="alert" aria-live="polite">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wide text-chart-axis">Warnings</div>
        <div className="text-[10px] text-chart-axis">
          {counts.error ? <span className="text-chart-negative-text">{counts.error} error </span> : null}
          {counts.warn ? <span className="text-chart-target">{counts.warn} warn </span> : null}
          {counts.info ? <span>{counts.info} info</span> : null}
        </div>
      </div>
      <ul className="space-y-1.5">
        {sorted.map((w, i) => {
          const t = tone(w.severity);
          return (
            <li key={i} className={`rounded border ${t.border} ${t.bg} p-2 text-xs flex gap-2`}>
              <span className={`font-bold ${t.text}`} aria-hidden>{t.icon}</span>
              <div className="space-y-0.5">
                <div className={`font-medium ${t.text}`}>{w.title}</div>
                <div className="text-foreground/70">{w.detail}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Token preview — shows every chart token in the active theme so the user can
 * verify what light/dark actually changes (background, axis, grid, tooltip,
 * status, anchors, ramps), with a live WCAG contrast ratio for each chrome
 * token vs. the chart background.
 */
/**
 * Pick a readable label color to print on top of a swatch.
 *
 * Swatch colors are *mark* colors, tuned to clear WCAG 2.2 SC 1.4.11 (3:1)
 * against the chart background. Printing a 10px hex label on them is text, so
 * it needs SC 1.4.3 (4.5:1). Hardcoding the theme background as the label
 * color failed on mid-tone swatches: white on #25935f is 3.88:1.
 *
 * Candidates are pure black and white, not theme tokens. The label sits on the
 * swatch, not on a themed surface, so it is not bound to the theme -- and the
 * pure extremes are the only pair that maximizes reachable contrast. Using
 * --chart-tooltip-fg (222 47% 11%) instead left the diverging mid-gray at
 * 4.09:1, where pure black reaches 4.74:1.
 */
const LABEL_DARK = fromCss("#000000");
const LABEL_LIGHT = fromCss("#ffffff");

/**
 * Scroll to a deep-linked section once the page stops growing under it.
 *
 * A single rAF is not enough: LazyMount panels and the auto-running sweep
 * mount after first paint, so an early scroll lands short and the target
 * drifts further down. A shared link that puts the reader in the wrong place
 * is the feature failing, so retry until the anchor is actually near the top
 * or the attempts run out.
 */
function scrollToSectionWhenSettled(id: string, attempts = 12) {
  const el = document.getElementById(`section-${id}`);
  if (!el) {
    if (attempts > 0) requestAnimationFrame(() => scrollToSectionWhenSettled(id, attempts - 1));
    return;
  }
  el.scrollIntoView({ behavior: "instant", block: "start" });
  if (attempts <= 0) return;
  // 56px clears the sticky bar; anything larger means the page moved.
  window.setTimeout(() => {
    const top = el.getBoundingClientRect().top;
    if (Math.abs(top) > 56) scrollToSectionWhenSettled(id, attempts - 1);
  }, 120);
}

function labelOn(swatch: Pick<ColorRecord, "rgb">): string {
  return contrastRatio(swatch, LABEL_DARK) >= contrastRatio(swatch, LABEL_LIGHT)
    ? LABEL_DARK.hex
    : LABEL_LIGHT.hex;
}

function TokenPreview({
  tokens,
  theme,
}: {
  tokens: ReturnType<typeof getChartTheme>["tokens"];
  theme: Theme;
}) {
  const bgRgb = tokens.bg.rgb;
  const ratio = (rgb: { r: number; g: number; b: number }) => {
    const fakeA = { hex: "", rgb, oklab: { l: 0, a: 0, b: 0 } };
    const fakeB = { hex: "", rgb: bgRgb, oklab: { l: 0, a: 0, b: 0 } };
    return contrastRatio(fakeA, fakeB);
  };

  type Row = { name: string; cssVar: string; rgb: { r: number; g: number; b: number }; hex: string; minRatio?: number };
  const chrome: Row[] = [
    { name: "Background", cssVar: "--chart-bg", rgb: tokens.bg.rgb, hex: tokens.bg.hex },
    { name: "Surface", cssVar: "--chart-surface", rgb: tokens.surface.rgb, hex: tokens.surface.hex },
    { name: "Grid", cssVar: "--chart-grid", rgb: tokens.grid.rgb, hex: tokens.grid.hex, minRatio: 1.2 },
    { name: "Axis / labels", cssVar: "--chart-axis", rgb: tokens.axis.rgb, hex: tokens.axis.hex, minRatio: 4.5 },
    { name: "Tooltip bg", cssVar: "--chart-tooltip-bg", rgb: tokens.tooltipBg.rgb, hex: tokens.tooltipBg.hex },
    { name: "Tooltip fg", cssVar: "--chart-tooltip-fg", rgb: tokens.tooltipFg.rgb, hex: tokens.tooltipFg.hex },
    { name: "Muted", cssVar: "--chart-muted", rgb: tokens.muted.rgb, hex: tokens.muted.hex },
    { name: "Other (overflow)", cssVar: "--chart-other", rgb: tokens.other.rgb, hex: tokens.other.hex, minRatio: 3 },
  ];
  const status: Row[] = [
    { name: "Positive", cssVar: "--chart-positive", rgb: tokens.positive.rgb, hex: tokens.positive.hex, minRatio: 3 },
    { name: "Negative", cssVar: "--chart-negative", rgb: tokens.negative.rgb, hex: tokens.negative.hex, minRatio: 3 },
    { name: "Target", cssVar: "--chart-target", rgb: tokens.target.rgb, hex: tokens.target.hex, minRatio: 3 },
    { name: "Forecast", cssVar: "--chart-forecast", rgb: tokens.forecast.rgb, hex: tokens.forecast.hex, minRatio: 3 },
  ];
  const anchors: Row[] = tokens.anchors.map((c, i) => ({
    name: `Anchor ${i + 1}`,
    cssVar: `--chart-cat-anchor-${i + 1}`,
    rgb: c.rgb,
    hex: c.hex,
    minRatio: 3,
  }));
  const ramps: Array<{ label: string; vars: string[]; colors: { hex: string; rgb: { r: number; g: number; b: number } }[] }> = [
    {
      label: "Sequential",
      vars: ["--chart-seq-low", "--chart-seq-high"],
      colors: [tokens.seqLow, tokens.seqHigh],
    },
    {
      label: "Diverging",
      vars: ["--chart-div-neg", "--chart-div-mid", "--chart-div-pos"],
      colors: [tokens.divNeg, tokens.divMid, tokens.divPos],
    },
  ];

  return (
    <details className="rounded border border-chart-grid p-3 text-xs">
      <summary className="cursor-pointer text-xs uppercase tracking-wide text-chart-axis hover:text-foreground">
        Token preview ({theme} theme)
      </summary>
      <div className="mt-3 space-y-4">
        {/* Live mock so the user sees background + axis + grid + tooltip in situ. */}
        <div
          className="rounded border border-chart-grid p-4 relative overflow-hidden"
          style={{ backgroundColor: tokens.bg.hex, color: tokens.axis.hex }}
        >
          <div className="text-[10px] uppercase tracking-wide" style={{ color: tokens.axis.hex }}>
            Sample chrome (background · axis · grid · tooltip)
          </div>
          <div className="mt-2 grid grid-cols-12 gap-px">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-12" style={{ backgroundColor: i % 3 === 0 ? tokens.grid.hex : "transparent" }} />
            ))}
          </div>
          <div
            className="absolute right-3 top-3 rounded px-2 py-1 text-xs"
            style={{ backgroundColor: tokens.tooltipBg.hex, color: tokens.tooltipFg.hex }}
          >
            Tooltip · 1,284
          </div>
        </div>

        <TokenGroup title="Chrome" rows={chrome} bgRatio={ratio} bgHex={tokens.bg.hex} />
        <TokenGroup title="Status" rows={status} bgRatio={ratio} bgHex={tokens.bg.hex} />
        <TokenGroup title="Categorical anchors" rows={anchors} bgRatio={ratio} bgHex={tokens.bg.hex} />

        {ramps.map((r) => (
          <div key={r.label}>
            <div className="text-[10px] uppercase tracking-wide text-chart-axis mb-1">{r.label} ramp</div>
            <div className="flex rounded overflow-hidden border border-chart-grid">
              {r.colors.map((c, i) => (
                <div
                  key={i}
                  className="flex-1 h-8 flex items-end justify-center text-[10px] font-mono pb-0.5"
                  style={{ backgroundColor: c.hex, color: labelOn(c) }}
                  title={`${r.vars[i]} · ${c.hex}`}
                >
                  {c.hex}
                </div>
              ))}
            </div>
            <div className="text-[10px] text-chart-axis mt-1 font-mono">{r.vars.join(" → ")}</div>
          </div>
        ))}
      </div>
    </details>
  );
}

function TokenGroup({
  title,
  rows,
  bgRatio,
  bgHex,
}: {
  title: string;
  rows: Array<{ name: string; cssVar: string; rgb: { r: number; g: number; b: number }; hex: string; minRatio?: number }>;
  bgRatio: (rgb: { r: number; g: number; b: number }) => number;
  bgHex: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-chart-axis mb-1">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
        {rows.map((r) => {
          const cr = bgRatio(r.rgb);
          const passes = r.minRatio == null || cr >= r.minRatio;
          return (
            <div
              key={r.cssVar}
              className="flex items-center gap-2 rounded border border-chart-grid p-1.5"
            >
              <span
                className="w-8 h-8 rounded border border-chart-grid flex items-center justify-center text-[8px] font-mono"
                style={{ backgroundColor: r.hex, color: bgHex }}
              >
                Aa
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-foreground truncate">{r.name}</div>
                <div className="text-[10px] text-chart-axis font-mono truncate">
                  {r.cssVar} · {r.hex}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-xs tabular-nums ${
                    passes ? "text-chart-positive-text" : "text-chart-negative-text"
                  }`}
                >
                  {cr.toFixed(2)}:1
                </div>
                {r.minRatio != null && (
                  <div className="text-[10px] text-chart-axis">≥ {r.minRatio}:1</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChartsDemo;

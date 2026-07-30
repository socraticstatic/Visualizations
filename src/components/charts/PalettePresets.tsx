/**
 * Named presets — capture (kind, n, theme) so designers can save, name, and
 * re-load configurations. Persisted in localStorage; ships with a small set of
 * curated starters tuned to common JTBD.
 *
 * Color overrides from the ColorPicker live in their own localStorage key
 * (managed by overrides.ts) and are intentionally NOT part of presets: we want
 * presets to be theme-stable across solver updates.
 */
import { useEffect, useMemo, useState } from "react";
import type { ChartKind } from "@/charts/chartKinds";
import { CHART_KIND_LABEL } from "@/charts/chartKinds";
import { BEST_PRACTICE } from "@/charts/bestPractices";
import type { Theme } from "@/charts/echartsTheme";

export interface Preset {
  id: string;
  name: string;
  kind: ChartKind;
  n: number;
  theme: Theme;
  curated?: boolean;
}

const CURATED: Preset[] = [
  { id: "curated-finance-kpi", name: "Finance KPI", kind: "line", n: 1, theme: "dark", curated: true },
  { id: "curated-analytics-exploratory", name: "Analytics exploratory", kind: "line", n: 6, theme: "dark", curated: true },
  { id: "curated-board-comparative", name: "Board / comparative", kind: "bar", n: 4, theme: "light", curated: true },
  { id: "curated-marketing-share", name: "Marketing share", kind: "stacked-bar", n: 5, theme: "light", curated: true },
  { id: "curated-ops-heatmap", name: "Ops heatmap", kind: "heatmap", n: 7, theme: "dark", curated: true },
  { id: "curated-variance", name: "Variance / diverging", kind: "diverging-bar", n: 5, theme: "light", curated: true },
];

const LS_KEY = "chart-palette-presets-v1";

function loadUser(): Preset[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Preset[];
    return Array.isArray(parsed) ? parsed.filter((p) => !p.curated) : [];
  } catch {
    return [];
  }
}

function saveUser(presets: Preset[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(presets));
}

interface Props {
  current: { kind: ChartKind; n: number; theme: Theme };
  onApply: (p: Preset) => void;
}

export function PalettePresets({ current, onApply }: Props) {
  const [user, setUser] = useState<Preset[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    setUser(loadUser());
  }, []);

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next: Preset = {
      id: `user-${Date.now()}`,
      name: trimmed,
      kind: current.kind,
      n: current.n,
      theme: current.theme,
    };
    const updated = [...user, next];
    setUser(updated);
    saveUser(updated);
    setName("");
  }

  function remove(id: string) {
    const updated = user.filter((p) => p.id !== id);
    setUser(updated);
    saveUser(updated);
  }

  const Chip = ({ p }: { p: Preset }) => (
    <div
      className={`group flex items-center gap-2 rounded border px-2 py-1 text-xs ${
        p.curated
          ? "border-chart-grid bg-chart-bg"
          : "border-chart-info/40 bg-chart-info/5"
      }`}
    >
      <button
        type="button"
        onClick={() => onApply(p)}
        className="text-foreground hover:underline"
        title={`${p.kind} · N=${p.n} · ${p.theme}`}
      >
        {p.name}
      </button>
      <span className="text-[10px] text-chart-axis">
        {p.kind}·{p.n}·{p.theme}
      </span>
      {!p.curated && (
        <button
          type="button"
          onClick={() => remove(p.id)}
          className="text-chart-negative opacity-0 group-hover:opacity-100 text-[10px]"
          title="Delete preset"
        >
          ×
        </button>
      )}
    </div>
  );

  return (
    <details className="panel p-4 text-xs" open>
      <summary className="cursor-pointer text-sm font-medium text-chart-axis">
        Presets
        <span className="ml-2 text-[11px] opacity-70 font-normal">
          Curated starters + your saved configurations
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-chart-axis mb-1">Curated</div>
          <div className="flex flex-wrap gap-1.5">
            {CURATED.map((p) => (
              <Chip key={p.id} p={p} />
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-chart-axis mb-1">
            Your presets {user.length === 0 && <span className="opacity-80">(none yet)</span>}
          </div>
          {user.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {user.map((p) => (
                <Chip key={p.id} p={p} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <label htmlFor="palette-preset-name" className="sr-only">
              Preset name
            </label>
            <input
              id="palette-preset-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              placeholder={`Name this preset (e.g. ${current.kind} · N=${current.n} · ${current.theme})`}
              className="flex-1 min-w-[200px] bg-chart-bg border border-chart-grid rounded px-2 py-1 text-foreground placeholder:text-chart-axis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus focus-visible:border-chart-focus"
            />
            <button
              type="button"
              onClick={add}
              disabled={!name.trim()}
              className="rounded border border-chart-info bg-chart-info text-chart-bg px-3 py-1 font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
            >
              Save preset
            </button>
          </div>
        </div>
        <PresetDiff current={current} all={[...CURATED, ...user]} />
      </div>
    </details>
  );
}

interface DiffProps {
  current: { kind: ChartKind; n: number; theme: Theme };
  all: Preset[];
}

const CURRENT_ID = "__current__";

function PresetDiff({ current, all }: DiffProps) {
  const options = useMemo<Preset[]>(
    () => [
      { id: CURRENT_ID, name: "Current builder", kind: current.kind, n: current.n, theme: current.theme },
      ...all,
    ],
    [current, all]
  );
  const [aId, setAId] = useState<string>(CURRENT_ID);
  const [bId, setBId] = useState<string>(all[0]?.id ?? CURRENT_ID);

  const a = options.find((p) => p.id === aId) ?? options[0];
  const b = options.find((p) => p.id === bId) ?? options[0];

  function summarize(p: Preset) {
    const r = BEST_PRACTICE[p.kind];
    return {
      kind: p.kind,
      kindLabel: CHART_KIND_LABEL[p.kind],
      family: r.family,
      posture: r.posture,
      recommendedN: r.recommendedN,
      maxN: r.maxN,
      n: p.n,
      theme: p.theme,
      above: p.n > r.recommendedN,
    };
  }

  const sa = summarize(a);
  const sb = summarize(b);

  const Row = ({
    label,
    av,
    bv,
  }: {
    label: string;
    av: string | number;
    bv: string | number;
  }) => {
    const same = String(av) === String(bv);
    return (
      <tr className={same ? "" : "bg-chart-warn/10"}>
        <td className="py-1 pr-3 text-chart-axis text-[11px] uppercase tracking-wide">{label}</td>
        <td className={`py-1 pr-3 tabular-nums ${same ? "" : "font-medium text-foreground"}`}>{av}</td>
        <td className={`py-1 tabular-nums ${same ? "" : "font-medium text-foreground"}`}>{bv}</td>
      </tr>
    );
  };

  return (
    <div className="rounded border border-chart-grid bg-chart-bg p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wide text-chart-axis">Compare presets</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-chart-axis">Preset A</span>
          <select
            value={aId}
            onChange={(e) => setAId(e.target.value)}
            className="bg-chart-surface border border-chart-grid rounded px-2 py-1 text-foreground"
          >
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-chart-axis">Preset B</span>
          <select
            value={bId}
            onChange={(e) => setBId(e.target.value)}
            className="bg-chart-surface border border-chart-grid rounded px-2 py-1 text-foreground"
          >
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-chart-axis text-[10px] uppercase">
            <th className="py-1 pr-3 font-normal">Field</th>
            <th className="py-1 pr-3 font-normal">{a.name}</th>
            <th className="py-1 font-normal">{b.name}</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Chart" av={sa.kindLabel} bv={sb.kindLabel} />
          <Row label="Family" av={sa.family} bv={sb.family} />
          <Row label="Posture" av={sa.posture} bv={sb.posture} />
          <Row label="N" av={`${sa.n}${sa.above ? " ⚠" : ""}`} bv={`${sb.n}${sb.above ? " ⚠" : ""}`} />
          <Row label="Recommended N" av={sa.recommendedN} bv={sb.recommendedN} />
          <Row label="Max N" av={sa.maxN} bv={sb.maxN} />
          <Row label="Theme" av={sa.theme} bv={sb.theme} />
        </tbody>
      </table>
      <p className="text-[10px] text-chart-axis">
        Rows highlighted in warning tint differ. ⚠ marks an N above the kind's recommended ceiling.
      </p>
    </div>
  );
}

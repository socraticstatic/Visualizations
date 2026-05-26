/**
 * Workflow presets — capture the FULL builder state (kind, n, theme, vision,
 * fixtures/dataMode, compare flag, and Variant B settings) so a designer can
 * return to a complete reviewing session in one click.
 *
 * Distinct from PalettePresets (which only stores kind/n/theme for a palette).
 * Color overrides from ColorPicker are intentionally NOT included — they live
 * in their own localStorage namespace.
 */
import { useEffect, useState } from "react";
import type { ChartKind } from "@/charts/chartKinds";
import { CHART_KIND_LABEL } from "@/charts/chartKinds";
import type { Theme } from "@/charts/echartsTheme";

export type Vision = "normal" | "deutan" | "protan" | "tritan" | "achromatopsia";
export type DataMode = "synthetic" | "messy";

export interface WorkflowState {
  kind: ChartKind;
  n: number;
  theme: Theme;
  vision: Vision;
  dataMode: DataMode;
  compare: boolean;
  kindB: ChartKind;
  nB: number;
  themeB: Theme;
}

export interface WorkflowPreset extends WorkflowState {
  id: string;
  name: string;
  savedAt: number;
}

const LS_KEY = "chart-workflow-presets-v1";
const SCHEMA_VERSION = 1;

function load(): WorkflowPreset[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return [];
    if (parsed.version !== SCHEMA_VERSION) return [];
    return parsed.items as WorkflowPreset[];
  } catch {
    return [];
  }
}

function save(items: WorkflowPreset[]) {
  localStorage.setItem(LS_KEY, JSON.stringify({ version: SCHEMA_VERSION, items }));
}

interface Props {
  current: WorkflowState;
  onApply: (p: WorkflowState) => void;
}

export function WorkflowPresets({ current, onApply }: Props) {
  const [items, setItems] = useState<WorkflowPreset[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    setItems(load());
  }, []);

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next: WorkflowPreset = {
      id: `wf-${Date.now()}`,
      name: trimmed,
      savedAt: Date.now(),
      ...current,
    };
    const updated = [...items, next];
    setItems(updated);
    save(updated);
    setName("");
  }

  function remove(id: string) {
    const updated = items.filter((p) => p.id !== id);
    setItems(updated);
    save(updated);
  }

  function exportAll() {
    const blob = new Blob(
      [JSON.stringify({ version: SCHEMA_VERSION, items }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chart-workflow-presets.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.items)) return;
        const incoming = parsed.items as WorkflowPreset[];
        // Merge, dedupe by id
        const byId = new Map<string, WorkflowPreset>();
        [...items, ...incoming].forEach((p) => byId.set(p.id, p));
        const merged = [...byId.values()];
        setItems(merged);
        save(merged);
      } catch {
        /* noop */
      }
    };
    reader.readAsText(file);
  }

  function describe(p: WorkflowState): string {
    const a = `${CHART_KIND_LABEL[p.kind]} · N=${p.n} · ${p.theme}`;
    const fixtures = p.dataMode !== "synthetic" ? ` · ${p.dataMode}` : "";
    const vision = p.vision !== "normal" ? ` · preview ${p.vision}` : "";
    const compare = p.compare
      ? ` · vs ${CHART_KIND_LABEL[p.kindB]} N=${p.nB} ${p.themeB}`
      : "";
    return `${a}${fixtures}${vision}${compare}`;
  }

  return (
    <details
      className="rounded-lg border border-chart-grid bg-chart-surface p-4 text-xs"
      open
    >
      <summary className="cursor-pointer text-sm font-medium text-chart-axis">
        Workflow presets
        <span className="ml-2 text-[11px] opacity-70 font-normal">
          Save and reload the entire builder state — kind, N, theme, vision, fixtures, and compare
        </span>
      </summary>

      <div className="mt-3 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-chart-axis mb-1">
            Saved workflows{" "}
            {items.length === 0 && <span className="opacity-80">(none yet)</span>}
          </div>
          {items.length > 0 && (
            <ul className="space-y-1 mb-2">
              {items.map((p) => (
                <li
                  key={p.id}
                  className="group flex items-center justify-between gap-2 rounded border border-chart-info/40 bg-chart-info/5 px-2 py-1"
                >
                  <button
                    type="button"
                    onClick={() => onApply(p)}
                    className="flex-1 text-left text-foreground hover:underline"
                    title={`Saved ${new Date(p.savedAt).toLocaleString()}`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-[10px] text-chart-axis">
                      {describe(p)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="text-chart-negative opacity-0 group-hover:opacity-100 text-xs"
                    title="Delete workflow"
                    aria-label={`Delete ${p.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              placeholder={`Save current workflow (${describe(current)})`}
              className="flex-1 min-w-[200px] bg-chart-bg border border-chart-grid rounded px-2 py-1 text-foreground"
            />
            <button
              type="button"
              onClick={add}
              disabled={!name.trim()}
              className="rounded border border-chart-grid bg-chart-info text-chart-bg px-2 py-1 font-medium disabled:opacity-40"
            >
              Save workflow
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-chart-grid/60">
          <button
            type="button"
            onClick={exportAll}
            disabled={items.length === 0}
            className="rounded border border-chart-grid bg-chart-bg px-2 py-1 text-chart-axis hover:text-foreground disabled:opacity-40"
            title="Download all saved workflows as JSON"
          >
            Export JSON
          </button>
          <label
            className="rounded border border-chart-grid bg-chart-bg px-2 py-1 text-chart-axis hover:text-foreground cursor-pointer"
            title="Import workflows from a JSON file (merges with existing)"
          >
            Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importFile(file);
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-[10px] text-chart-axis">
            Stored in localStorage on this device.
          </span>
        </div>
      </div>
    </details>
  );
}

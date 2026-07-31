/**
 * Per-entity slot pinning UI.
 *
 * Lets a designer say "Acme is always slot 0 (red), Globex is always slot 2
 * (blue)" so the same entity keeps the same color/dash/decal/shape across
 * filters, reloads, and dashboards. Persists via `setEntityColor` in
 * `overrides.ts` (localStorage). Auto-resolves collisions: when two entities
 * pin to the same slot, the second is bumped to the next free slot and
 * surfaced in the "Collisions" line.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { setEntityColor, getEntityColor, clearEntityColor, clearEntityColors } from "@/charts/overrides";
import { buildPinPermutation } from "@/charts/entityPins";

interface Props {
  /** Active entity names, in their natural display order. */
  entities: string[];
  /** Number of slots in the active palette. */
  n: number;
  /** Resolved hex per slot, used to render swatches. */
  colorHexes: string[];
  /** Bumped whenever a pin changes so parents can rebuild the theme. */
  onChange: () => void;
}

export function EntityPins({ entities, n, colorHexes, onChange }: Props) {
  // Re-read on mount and on every change so we render the persisted state.
  const [rev, setRev] = useState(0);
  const bump = useCallback(() => setRev((r) => r + 1), []);

  useEffect(() => {
    // Initial mount — make sure parent is in sync.
    onChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { slots, collisions } = useMemo(
    () => buildPinPermutation(entities, n),
    // rev forces recompute after writes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entities, n, rev]
  );

  function handlePick(entityId: string, slot: number) {
    setEntityColor(entityId, slot);
    bump();
    onChange();
  }

  function handleClear() {
    clearEntityColors();
    bump();
    onChange();
  }

  return (
    <details className="panel p-4 text-xs">
      <summary className="cursor-pointer text-sm font-medium text-chart-axis">
        Entity pins
        <span className="ml-2 text-[11px] opacity-70 font-normal">
          Lock a series to a specific slot (color · dash · decal · shape)
        </span>
      </summary>
      <div className="mt-3 space-y-2">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-chart-axis text-[10px] uppercase">
                <th className="py-1 pr-3 font-normal">Series</th>
                <th className="py-1 pr-3 font-normal">Pinned slot</th>
                <th className="py-1 pr-3 font-normal">Active slot</th>
                <th className="py-1 font-normal">Swatch</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((id, i) => {
                const pinned = getEntityColor(id);
                const active = slots[i];
                const swatch = colorHexes[i] ?? "transparent";
                const isCollision = collisions.includes(id);
                return (
                  <tr key={id} className={isCollision ? "bg-chart-warn/10" : ""}>
                    <td className="py-1 pr-3 text-foreground">{id}</td>
                    <td className="py-1 pr-3">
                      <select
                        value={pinned ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            clearEntityColor(id);
                            bump();
                            onChange();
                          } else {
                            handlePick(id, Number(v));
                          }
                        }}
                        className="tap-target bg-chart-bg border border-chart-grid rounded px-1 py-0.5 text-foreground"
                      >
                        <option value="">Auto</option>
                        {Array.from({ length: n }, (_, s) => (
                          <option key={s} value={s}>
                            {/* 1-based to match every audit panel ("#1", "slot 2"). */}
                            Slot {s + 1}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-3 tabular-nums text-chart-axis">{active + 1}</td>
                    <td className="py-1">
                      <span
                        className="inline-block w-5 h-3 rounded-sm border border-chart-grid align-middle"
                        style={{ backgroundColor: swatch }}
                        title={swatch}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {collisions.length > 0 && (
          <p className="text-[11px] text-chart-warn-text">
            Collisions ({collisions.length}): {collisions.join(", ")} requested a slot already
            taken by an earlier series. They were bumped to the next free slot.
          </p>
        )}
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-chart-axis">
            Pins persist under <code>localStorage["chart-entity-color-pins-v1"]</code> and apply
            to color, dash, decal, and shape simultaneously.
          </p>
          <button
            type="button"
            onClick={handleClear}
            className="rounded border border-chart-grid bg-chart-bg px-2 py-1 text-[11px] hover:bg-chart-grid/30"
          >
            Clear all pins
          </button>
        </div>
      </div>
    </details>
  );
}

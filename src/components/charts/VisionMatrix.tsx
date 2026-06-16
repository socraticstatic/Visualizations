/**
 * Vision Matrix — render the current chart under one vision condition at a
 * time (normal / deutan / protan / tritan / achromatopsia), chosen from a
 * dropdown. One full-width chart per row so series are actually legible,
 * instead of five cramped tiles forced into a horizontal scroll.
 *
 * Filters are the same SVG defs already mounted by <VisionFilters /> on
 * ChartsDemo. The matrix is a pure presentation wrapper.
 */
import { useState } from "react";
import { EChart } from "./EChart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Mode = "normal" | "deutan" | "protan" | "tritan" | "achromatopsia";

const MODES: Array<{ id: Mode; label: string; sub: string; filter: string }> = [
  { id: "normal", label: "Normal", sub: "trichromatic", filter: "none" },
  { id: "deutan", label: "Deuteranopia", sub: "~6% of men", filter: "url(#cvd-deutan)" },
  { id: "protan", label: "Protanopia", sub: "~2% of men", filter: "url(#cvd-protan)" },
  { id: "tritan", label: "Tritanopia", sub: "rare, ~0.01%", filter: "url(#cvd-tritan)" },
  { id: "achromatopsia", label: "Grayscale", sub: "print / projector", filter: "grayscale(1)" },
];

interface Props {
  option: Record<string, unknown>;
  /** Chart height in px. */
  height?: number;
}

export function VisionMatrix({ option, height = 320 }: Props) {
  const [mode, setMode] = useState<Mode>("normal");
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <section className="rounded-lg border border-chart-grid bg-chart-surface p-4 space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-chart-axis">
            Vision matrix
          </h2>
          <p className="text-[11px] text-chart-axis mt-0.5 max-w-md">
            The same chart simulated under a chosen vision condition. Switch conditions and watch
            for series that collapse into each other; dash / decal / shape should still
            differentiate them.
          </p>
        </div>
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger className="w-[220px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
                <span className="text-chart-axis"> · {m.sub}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="rounded border border-chart-grid bg-chart-bg overflow-hidden">
        <div className="flex items-baseline justify-between px-3 py-1.5 border-b border-chart-grid">
          <span className="text-[11px] font-medium text-foreground">{active.label}</span>
          <span className="text-[10px] text-chart-axis">{active.sub}</span>
        </div>
        <div style={{ filter: active.filter }}>
          <EChart option={option} height={height} />
        </div>
      </div>
    </section>
  );
}

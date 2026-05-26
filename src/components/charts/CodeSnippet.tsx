/**
 * Copy-paste React component emitter. Shows the snippet for the current
 * chart kind + N + palette so engineers can ship the chart without
 * adopting the whole token system.
 */
import { useMemo, useState } from "react";
import { buildCodeSnippet } from "@/charts/codeSnippet";
import type { ChartTheme } from "@/charts/echartsTheme";
import type { ChartKind } from "@/charts/chartKinds";
import { toast } from "@/hooks/use-toast";

export interface CodeSnippetProps {
  kind: ChartKind;
  n: number;
  theme: ChartTheme;
}

export function CodeSnippet({ kind, n, theme }: CodeSnippetProps) {
  const [open, setOpen] = useState(false);
  const code = useMemo(() => buildCodeSnippet({ kind, n, theme }), [kind, n, theme]);

  function copy() {
    navigator.clipboard
      .writeText(code)
      .then(() => toast({ title: "Snippet copied", description: "Paste into your project as a .tsx file." }))
      .catch(() => toast({ title: "Copy failed", description: "Select the text manually." }));
  }

  function download() {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-chart.tsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-md border border-chart-grid bg-chart-bg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] uppercase tracking-wide text-chart-axis">
          Ready-to-paste React + ECharts snippet
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs px-2 py-1 rounded border border-chart-grid text-foreground hover:bg-chart-grid/30"
          >
            {open ? "Hide" : "Show"} code
          </button>
          <button
            type="button"
            onClick={copy}
            className="text-xs px-2 py-1 rounded border border-chart-grid bg-chart-info text-chart-bg hover:opacity-90"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={download}
            className="text-xs px-2 py-1 rounded border border-chart-grid bg-chart-surface text-foreground hover:bg-chart-grid/30"
          >
            Download .tsx
          </button>
        </div>
      </div>
      <p className="text-[11px] text-chart-axis">
        Self-contained — only depends on <code>echarts</code> and <code>echarts-for-react</code>.
        Palette, dashes, decals and shapes are baked in at the audited values.
      </p>
      {open && (
        <pre className="text-[11px] leading-relaxed bg-chart-surface border border-chart-grid rounded p-2 overflow-auto max-h-80 text-foreground/90">
          <code>{code}</code>
        </pre>
      )}
    </section>
  );
}

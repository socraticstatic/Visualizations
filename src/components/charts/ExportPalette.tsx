/**
 * Export modal for the current palette snapshot.
 *
 * Tabs across the five emitters in `paletteExport.ts`. Each tab shows the
 * generated text in a read-only textarea with copy + download actions.
 * SVG tab gets a live preview above the source.
 */
import { useMemo, useState } from "react";
import { EXPORT_FORMATS, type ExportFormat, type PaletteExport } from "@/charts/paletteExport";

interface Props {
  open: boolean;
  onClose: () => void;
  snapshot: PaletteExport;
}

export function ExportPalette({ open, onClose, snapshot }: Props) {
  const [active, setActive] = useState<ExportFormat>("css");
  const [copied, setCopied] = useState(false);

  const fmt = useMemo(() => EXPORT_FORMATS.find((f) => f.id === active)!, [active]);
  const content = useMemo(() => fmt.build(snapshot), [fmt, snapshot]);

  if (!open) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore — user can still select & copy manually */
    }
  }

  function download() {
    const blob = new Blob([content], { type: fmt.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fmt.filename(snapshot.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export palette"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col panel shadow-2xl">
        <header className="flex items-center justify-between px-4 py-3 border-b border-chart-grid">
          <div>
            <h2 className="text-sm font-medium text-foreground">Export palette</h2>
            <p className="text-[11px] text-chart-axis">
              {snapshot.name} · {snapshot.themeA.theme} · N={snapshot.themeA.effectiveN}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-chart-axis hover:text-foreground px-2 py-1 rounded"
            aria-label="Close export dialog"
          >
            Close ✕
          </button>
        </header>

        <div className="flex gap-1 px-4 pt-3 flex-wrap" role="tablist">
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={active === f.id}
              onClick={() => setActive(f.id)}
              className={`text-xs px-3 py-1.5 rounded-t border-b-2 transition-colors ${
                active === f.id
                  ? "border-chart-info text-foreground bg-chart-bg"
                  : "border-transparent text-chart-axis hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto px-4 pb-4 space-y-3">
          {active === "svg" && (
            <div
              className="rounded border border-chart-grid bg-chart-bg p-2 overflow-auto"
              aria-label="SVG preview"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-chart-axis">
              {fmt.filename(snapshot.name)} · {fmt.language}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copy}
                className="text-xs px-3 py-1 rounded border border-chart-grid bg-chart-bg text-foreground hover:bg-chart-grid/30"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <button
                type="button"
                onClick={download}
                className="text-xs px-3 py-1 rounded border border-chart-grid bg-chart-info-strong text-chart-bg font-medium hover:opacity-90"
              >
                Download
              </button>
            </div>
          </div>
          <textarea
            readOnly
            value={content}
            className="w-full h-[40vh] resize-none rounded border border-chart-grid bg-chart-bg p-3 text-[11px] font-mono text-foreground leading-relaxed"
            spellCheck={false}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      </div>
    </div>
  );
}

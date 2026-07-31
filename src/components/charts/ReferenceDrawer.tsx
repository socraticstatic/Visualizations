/**
 * ReferenceDrawer — the glossary, reachable from every section instead of
 * parked at the bottom of the page.
 *
 * Reference stopped being a destination. The old Glossary panel rendered at
 * screen 8.8 of an 8.1-screen page, collapsed, which is a good way to write
 * twelve careful definitions nobody reads.
 *
 * Radix Dialog supplies the focus trap, Esc handling, and focus restore, so
 * none of that is hand-rolled here.
 */
import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { GLOSSARY } from "@/charts/glossary";

export function ReferenceDrawer({
  open,
  onClose,
  focusTerm,
}: {
  open: boolean;
  onClose: () => void;
  /** Scroll to this entry on open, set when arriving from a <Term> popover. */
  focusTerm?: string;
}) {
  const listRef = useRef<HTMLDListElement>(null);

  useEffect(() => {
    if (!open || !focusTerm) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-term="${CSS.escape(focusTerm)}"]`
    );
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "center" });
  }, [open, focusTerm]);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          aria-label="Reference"
          className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-xl flex-col border-l border-chart-grid bg-chart-bg sm:w-[36rem]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-chart-grid p-4">
            <div>
              <Dialog.Title className="text-sm font-medium uppercase tracking-wide text-chart-muted-text">
                Reference
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[11px] text-chart-muted-text">
                Plain-language definitions for every term in the audit and reports.
              </Dialog.Description>
            </div>
            <Dialog.Close className="tap-target rounded border border-chart-grid px-2 text-xs text-chart-muted-text transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus">
              Close
            </Dialog.Close>
          </div>

          <dl ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {GLOSSARY.map((e) => (
              <div key={e.term} data-term={e.term} className="space-y-1">
                <dt className="text-sm font-medium text-foreground">{e.term}</dt>
                <dd className="text-xs text-chart-muted-text">
                  <span className="text-foreground/80">{e.short}</span> {e.detail}
                  {e.source && (
                    <span className="mt-0.5 block font-mono text-[10px] text-chart-muted-text">
                      {e.source}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * "Copy share link" button. Encodes the current builder configuration in the
 * URL hash and copies the resulting absolute URL to the clipboard. The hook
 * `useUrlStateSync` keeps `location.hash` in sync as the user edits.
 */
import { useEffect } from "react";
import { encodeUrlState, decodeUrlState, type UrlState } from "@/charts/urlState";
import { toast } from "@/hooks/use-toast";

export function useUrlStateSync(state: UrlState, apply: (s: Partial<UrlState>) => void) {
  // On first mount, hydrate from hash.
  useEffect(() => {
    const initial = decodeUrlState(window.location.hash);
    if (Object.keys(initial).length > 0) apply(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep hash in sync as state changes.
  useEffect(() => {
    const next = `#${encodeUrlState(state)}`;
    if (window.location.hash !== next) {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}${next}`);
    }
  }, [state]);
}

export function ShareLink({ state }: { state: UrlState }) {
  function copy() {
    const hash = encodeUrlState(state);
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    navigator.clipboard
      .writeText(url)
      .then(() =>
        toast({
          title: "Share link copied",
          description: "Paste in a ticket or Slack — anyone who opens it lands on this exact configuration.",
        })
      )
      .catch(() => toast({ title: "Copy failed", description: "Copy from the address bar instead." }));
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md border border-chart-grid bg-chart-surface text-foreground px-3 py-1 text-xs font-medium hover:bg-chart-grid/30"
      title="Copy a permalink to this exact chart kind, N, theme, and compare state."
    >
      Copy share link
    </button>
  );
}

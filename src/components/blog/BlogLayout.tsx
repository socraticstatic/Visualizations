import { useEffect } from "react";
import { Heart } from "lucide-react";
import { Link } from "react-router";
import { PALETTE_VERSION } from "@/charts/version";

/**
 * The builder writes `dark` onto <html> from its chart-theme control, which is
 * an authoring choice, not a reading preference - and it leaves the class in
 * place when you navigate away. Reading pages follow the reader's system
 * instead, so a direct visit to a post is not stuck in whatever the builder
 * was last set to. Returning to the builder re-asserts its own theme on mount.
 */
function useSystemTheme() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
}

/**
 * Shell for every blog route.
 *
 * The blog is a section of the chart system, not a separate property, so the
 * bar keeps a single unambiguous way back to the builder rather than a nav
 * that competes with it. On mobile the bar stays one row: the wordmark
 * shortens, the sponsor label drops to its icon.
 */
export function BlogLayout({ children }: { children: React.ReactNode }) {
  useSystemTheme();
  return (
    <div className="min-h-dvh bg-[hsl(var(--page-bg))] text-foreground">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-chart-surface focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:ring-chart-focus"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-chart-grid bg-[hsl(var(--page-bg)/0.92)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4 sm:px-6">
          <Link
            to="/"
            className="tap-target flex min-w-0 items-center gap-2 rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-end justify-center gap-0.5 rounded bg-primary p-1"
              aria-hidden
            >
              <span className="w-1 rounded-sm" style={{ height: "45%", background: "hsl(var(--chart-cat-anchor-1))" }} />
              <span className="w-1 rounded-sm" style={{ height: "100%", background: "hsl(var(--chart-cat-anchor-2))" }} />
              <span className="w-1 rounded-sm" style={{ height: "70%", background: "hsl(var(--chart-cat-anchor-3))" }} />
            </span>
            <span className="truncate">
              <span className="hidden sm:inline">Micah's Chart System</span>
              <span className="sm:hidden">Chart System</span>
            </span>
          </Link>

          <span className="text-chart-grid" aria-hidden>
            /
          </span>
          {/* inline-flex + items-center is load-bearing: .tap-target only sets
              a 44px minimum on coarse pointers, so a non-flex link renders its
              text at the top of that box instead of centered in the bar. */}
          <Link
            to="/blog"
            className="tap-target inline-flex items-center rounded-md text-sm text-chart-muted-text hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
          >
            Notes
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              to="/"
              className="tap-target hidden items-center rounded-md border border-chart-grid bg-chart-surface px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-chart-grid/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus sm:inline-flex"
            >
              Open the builder
            </Link>
            <a
              href="https://github.com/sponsors/socraticstatic"
              target="_blank"
              rel="noopener noreferrer"
              className="tap-target inline-flex items-center gap-1.5 rounded-md border border-chart-grid bg-chart-surface px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-chart-grid/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
              aria-label="Sponsor this project on GitHub"
            >
              <Heart className="h-3.5 w-3.5 text-chart-negative-text" aria-hidden />
              <span className="hidden sm:inline">Sponsor</span>
            </a>
          </div>
        </div>
      </header>

      <main id="content">{children}</main>

      <footer className="mt-16 border-t border-chart-grid">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-4 py-6 text-xs text-chart-muted-text sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Micah's Chart System · v{PALETTE_VERSION} · built by{" "}
            <a
              href="https://conscious-shell.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-2 hover:text-primary"
            >
              Micah Boswell
            </a>
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/" className="hover:text-foreground">
              Builder
            </Link>
            <a
              href="https://www.npmjs.com/package/chart-color-system"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              npm
            </a>
            <a
              href="https://github.com/sponsors/socraticstatic"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-chart-grid bg-chart-surface px-2.5 py-1 text-foreground transition-colors hover:bg-chart-grid/30"
            >
              <Heart className="h-3.5 w-3.5 text-chart-negative-text" aria-hidden />
              Sponsor this project
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Shared reading column. One measure for every post, set in one place. */
export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[68ch] px-4 sm:px-6">{children}</div>;
}

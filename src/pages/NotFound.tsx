import { Link, useLocation } from "react-router";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[hsl(var(--page-bg))] p-6 text-foreground">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">404</h1>
        <p className="mt-2 text-sm text-chart-muted-text">
          That page does not exist, or its link has changed.
        </p>
        {/* Router Link, not a bare href: the app is served under a basename on
            GitHub Pages, and "/" would leave the site entirely. */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="tap-target rounded-md border border-chart-grid bg-chart-surface px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-chart-grid/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
          >
            Open the builder
          </Link>
          <Link
            to="/blog"
            className="tap-target rounded-md px-3 py-1.5 text-xs text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
          >
            All notes
          </Link>
        </div>
      </div>
    </main>
  );
};

export default NotFound;

/* eslint-disable react-refresh/only-export-components --
   This module is a build-time entry, not a component file: it is compiled into
   the SSR bundle and never reaches a browser, so fast refresh does not apply. */
/**
 * Build-time render target. Vite compiles this to an SSR bundle that
 * scripts/prerender.mjs imports; it never ships to a browser.
 *
 * It mounts the same AppRoutes the client mounts, under a StaticRouter with
 * the deploy basename, so the hrefs in the prerendered HTML are the hrefs a
 * crawler should follow.
 */
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { AppRoutes, AppShell } from "@/App";
import BuilderSummary from "@/seo/BuilderSummary";
import { routes, staticPages, SITE, FAQ, url, type RouteMeta } from "@/seo/site";

/**
 * Returns the inner HTML for #root, or "" when the route ships the bare shell.
 * Throws rather than returning a half-rendered string: a route that cannot be
 * rendered must fail the build, not ship empty with a 200.
 */
export function render(meta: RouteMeta): string {
  if (meta.render === "shell") return "";

  const base = SITE.base;
  const location = base.replace(/\/$/, "") + meta.route;

  // Both modes need router context: the summary shares the blog shell, whose
  // header and footer are <Link>s.
  return renderToString(
    <AppShell>
      <StaticRouter basename={base} location={location}>
        {meta.render === "summary" ? <BuilderSummary /> : <AppRoutes />}
      </StaticRouter>
    </AppShell>,
  );
}

export { routes, staticPages, SITE, FAQ, url };
export type { RouteMeta };

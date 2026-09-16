# Releasing

The engine is published in four places and they drift independently. Three of
them are outward-facing and irreversible enough that they are done by hand, on
purpose.

## When a release is needed

Any change to solver output. `PALETTE_VERSION` in `src/charts/version.ts` and
`"version"` in `package.json` must move together — `version.test.ts` enforces
that — and `src/charts/__tests__/__golden__/palette-sweep.csv` must be
regenerated with `node scripts/freeze-palette-sweep.mjs`.

If the golden sweep changes and you did **not** intend to change the solver,
stop: something moved that should not have. That file exists because the
solver once returned a different palette per JavaScript engine
(`docs/spikes/engine-divergence.md`).

## The sequence

Order matters. Step 2 cannot resolve until step 1 is on the registry.

1. **npm.** `npm run build:lib && npm run publish:lib`.
   Auth is a WebAuthn security key on the `socraticstatic` account; there is no
   TOTP fallback, so this cannot be automated and has to be driven by a human
   at the machine.

2. **MCP server.** Bump `chart-color-system` in `mcp/package.json` to the new
   `^` range, `npm install` in `mcp/` to update the lockfile, redeploy.
   Until this lands, the deployed MCP answers assistants with palettes the site
   no longer shows. `publishedSurface.test.ts` fails for exactly as long as
   this step is outstanding.

3. **Frozen benchmark figures.** `npm run freeze:benchmark` on `main`.
   The benchmark post's numbers are frozen at build time rather than solved per
   reader, and are pinned to `PALETTE_VERSION` by a test. The published figures
   change when the engine does, and that post is the most substantial
   crawlable page on the site.

4. **The discovery copy.** The engine version in the generated `llms.txt` is
   hand-written prose in the discovery generator on `main`, not derived from
   `PALETTE_VERSION`, and no test guards it. Answer engines read that file, so
   a stale string there misreports the product. Update it by hand.

## Why there is a failing test

Between an engine change and step 2, `publishedSurface.test.ts` fails on
purpose. A half-finished release should be loud rather than silent; the drift
that prompted this file was found by reading the live site, not by the suite.
The failure message carries the sequence above.

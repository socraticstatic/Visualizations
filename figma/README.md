# chart-color-figma

The Chart Color System as a Figma plugin.

Proprietary (see `../LICENSE`). It bundles the MIT engine from `../src/charts`
through the `@engine` alias rather than the npm package, so it is not an npm
consumer. The MCP server already fills that role.

Declares no network access: `"networkAccess": { "allowedDomains": ["none"] }`.
That is why the UI builds to a single HTML file with everything inlined, and
why the ECharts-backed mockup command belongs to a later plan.

Plugin development is Figma desktop only; browser Figma has no
`Plugins -> Development` menu.

```bash
npm install
npm run build   # -> dist/code.js and dist/ui.html
npm test
```

Then in Figma desktop: Plugins, Development, Import plugin from manifest, and
choose `figma/manifest.json`.

Plan: `../docs/superpowers/plans/2026-09-15-figma-plugin-plan-1.md`
Spec: `../docs/superpowers/specs/2026-09-14-figma-plugin-design.md`

## Plugin id

`manifest.json` carries a local development `id`. `figma.clientStorage` refuses
to work without one ("Cannot access client storage without a plugin ID"), which
is how a licence verified in the panel and was rejected where the work happens.
Figma assigns the real id on first publish; replace it then.

# chart-color-mcp

The Chart Color System as a read-only MCP server: the same engine as the app (npm `chart-color-system`), callable by any assistant. The app is static on GitHub Pages, so this directory is its own Vercel project (`chart-color-mcp`, team socraticstatics-projects), deployed from here, not from the Pages workflow.

- Endpoint: `https://chart-color-mcp.vercel.app/mcp`
- Docs for humans and assistants: https://socraticstatic.github.io/Visualizations/mcp-docs.html (source: `public/mcp-docs.html`)
- Tools: `solve_palette` (anchored, audited categorical palette), `audit_palette` (pass / warn / fail with the numbers), `simulate_palette` (deutan, protan, tritan, achromatopsia), `build_ramp` (sequential or diverging)
- Engine version is reported in every result (`engine_version`); bump the `chart-color-system` dependency to ship a new engine.

Deploy and verify:

```bash
cd mcp && npm run deploy && npm test
```

`npm test` runs the contract tests against production; `MCP_BASE=<preview url> npm test` runs them against a preview deployment.

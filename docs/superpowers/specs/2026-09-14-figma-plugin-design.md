# Chart Color System Figma Plugin

Design spec. 2026-09-14.

## Why

The engine is credible in code and invisible in design. A designer mocking a
five-series chart in Figma picks hexes by eye, hands off, and the developer
either honors an unaudited palette or quietly overrides it. Both outcomes lose.
JTBD-2 (color plus dash, decal, shape) and JTBD-5 (light and dark equally good)
die at exactly this seam.

A plugin moves the audited system into the tool where the decision is actually
made.

## Goals

| # | Goal | Serves |
|---|---|---|
| G1 | Generate an audited palette and write it into the file as Figma variables | JTBD-1, 3, 5, 9, 12 |
| G2 | Carry the non-color encodings (dash, decal, shape) into Figma alongside color | JTBD-2 |
| G3 | Audit colors already in a file, whether or not they came from this system | JTBD-1, 7 |
| G4 | Render CVD simulations onto the canvas so failure is seen, not read | JTBD-2, 7 |

## Non-goals

- Generating chart mockups (bar, line, area, scatter frames). Explicitly cut.
- Reading Figma files from outside the plugin. No REST API, no server.
- Writing back to the repo, syncing tokens bidirectionally, or telemetry.
- Multi-tenant or team-level palette storage.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Location | `figma/` in this repo, beside `mcp/` | One `PALETTE_VERSION`, one test suite, one source of truth. `mcp/` already proved the in-repo satellite pattern. |
| Engine delivery | Bundled from npm `chart-color-system` | The plugin becomes a real consumer of the public API barrel, like `mcp/` is. |
| Network | `"networkAccess": {"allowedDomains": ["none"]}` | An audit tool that transmits nothing is a better audit tool, and it shortens Community review. Verified as the documented syntax for a plugin making no requests. |
| Engine execution | iframe UI only | The sandbox has no DOM and a restricted runtime. No color math crosses into it. |
| Distribution | Public Figma Community plugin | Best distribution this system will ever get: designers who will never `npm install` anything. |
| Dark on 1-mode plans | Fall back to a second collection | Preserves JTBD-5 on every plan. Cost is branching logic and a clumsier output for free users. |

## Architecture

```
figma/
  manifest.json
  package.json          private: true, deps: chart-color-system, culori
  vite.config.ts        two builds: sandbox (IIFE) + ui (single-file inline)
  src/
    sandbox/
      main.ts           dispatcher only
      variables.ts      applies a VariableSpec[] via the figma API
      selection.ts      walks the selection, delegates to extractFills
      simulate.ts       clones frames, applies a SimulationSpec
    shared/
      protocol.ts       message types, the contract between contexts
      spec.ts           buildVariableSpec  (pure)
      fills.ts          extractFills       (pure)
      color.ts          Figma RGB 0..1  <->  engine ColorRecord  (pure)
    ui/
      index.html
      App.tsx           three tabs, shared state
      ...
  __tests__/            vitest over the pure modules
```

Two contexts, split on capability:

```
iframe UI (React + chart-color-system)        sandbox (figma API)
  solveCategorical, sequentialRamp  ──write-variables──►  createVariableCollection, setValueForMode
  auditPalette, contrastRatio       ◄─selection-colors──  traverse selection, extractFills
  simulateRgb                       ──render-simulation─►  clone frames, rewrite fills, lay out beside
```

The sandbox is deliberately dumb. Everything it does is a spec it was handed.
That keeps the untested surface down to Figma API calls themselves.

## Variable schema

One collection, `Chart Color System`, modes `Light` and `Dark`.

```
chart/series/1/color      COLOR
chart/series/1/dash       STRING   e.g. "6 3"
chart/series/1/decal      STRING   e.g. "diagonal"
chart/series/1/shape      STRING   e.g. "circle"
...through N, where N is capped at min(POSTURE[posture].maxCategorical, MAX_SLOTS)
chart/surface             COLOR
chart/grid                COLOR
chart/axis                COLOR
chart/label               COLOR
chart/sequential/1..k     COLOR    when a sequential ramp is requested
chart/diverging/1..k      COLOR    when a diverging ramp is requested
```

The STRING variables are the differentiator. Every palette plugin writes colors.
None of them carry the redundant encodings, which is what actually keeps series
distinguishable past six hues.

Collection metadata (engine version, N, posture, seed, anchors) is stored via
`setPluginData` on the collection, which implements `PluginDataMixin` (verified) so a re-run can update in place rather than
duplicate.

## Commands

Three manifest menu entries, one UI shell, three tabs. State persists across
tabs so a designer can audit a selection and then generate a palette that fixes
it without relaunching.

### 1. Generate

Inputs: N, posture (`kpi` 8 max, `comparative` 12, `exploratory` 12), anchor
locks, background, sequential/diverging ramp toggles and steps.

Runs `solveCategorical` and the ramp builders in the iframe. Shows the result
with its audit inline before anything is written. Writing is a separate,
explicit action. Nothing touches the file until the designer says so.

On write: create or update the collection, set both modes, return a summary of
what changed.

### 2. Audit

Reads `figma.currentPage.selection`, walks it, calls `extractFills`.

Honesty rules, non-negotiable:
- Opacity is composited against the resolved parent background before auditing.
- Gradient stops are audited individually, never averaged.
- Image fills are refused with a stated reason, not given a number.
- Blend modes other than `NORMAL` are flagged as unaudited.

Reports pass / warn / fail with the numbers, and names the colliding pairs.

### 3. Simulate

Clones the selected frames, rewrites every resolved fill through `simulateRgb`
for deutan, protan, tritan, and achromatopsia, lays the results out beside the
original with labels. Originals are never mutated.

## Message protocol

`shared/protocol.ts` is the contract. Discriminated union both ways, every
sandbox reply carries either `ok: true` with a payload or `ok: false` with a
typed reason. No thrown strings crossing the boundary.

## Pure function contracts

| Function | In | Out | Never touches |
|---|---|---|---|
| `buildVariableSpec` | `SolveResult`, ramps, options | `VariableSpec[]` | `figma` |
| `extractFills` | node tree (mockable) | `ExtractedFill[]` with provenance | `figma` |
| `toFigmaRgb` / `fromFigmaRgb` | sRGB 0..1 <-> `ColorRecord` | round-trip stable | `figma` |

These three carry the real logic and are fully unit-testable with no Figma
present.

## Error handling

| Condition | Response |
|---|---|
| `addMode` throws `in addMode: Limited to N modes only` | Write a second collection `Chart Color System Dark` with identical variable names. Explain why in the UI. |
| No selection on Audit or Simulate | Empty state naming the action, not an error toast. |
| Selection has no solid fills | Report what was found (images, gradients, no fills) rather than "0 results". |
| Collection name already exists | Update in place, keyed by `setPluginData`. Never silently duplicate. |
| Solver infeasible | Surface the engine's documented relaxation order. Do not swallow. |
| N above the cap (`min(POSTURE[posture].maxCategorical, MAX_SLOTS)`) | Clamp, state the cap and which of the two bound it, offer Top-N plus Other. |
| Image fill encountered | Refuse with reason. No fabricated number. |

## Testing

Vitest in `figma/`, over the pure modules:

- `buildVariableSpec`: schema shape, N clamping, ramp inclusion, both modes, stable naming.
- `extractFills`: mocked node trees covering nesting, opacity compositing, gradient stops, image refusal, non-normal blend modes.
- `color`: round-trip stability across the sRGB boundary and gamut edges.
- Protocol: every sandbox reply is a valid union member.

Not unit-tested: the Figma API calls themselves. Those are covered by the
verification bar below.

## Verification bar

Plugin development is Figma desktop only. Browser Figma has no
`Plugins -> Development` menu. Figma.app is installed on this machine.

Done means, in Figma desktop:

1. Imported from manifest, all three commands appear.
2. Generate writes the collection; variables are present and correctly valued in both modes.
3. File reloaded; variables survived.
4. Re-running Generate updates in place and does not create a duplicate collection.
5. Audit run against a deliberately bad selection returns failures that match what the engine returns for the same colors.
6. Simulate produces frames that are visibly wrong in the expected way, with originals untouched.
7. The 1-mode fallback exercised, by whatever means available.

"The build succeeded" is not verification.

## Packaging and publishing

Community submission needs an icon (128x128), cover art (1920x960),
screenshots, a tagline, and review.

Licensing: the engine is MIT, this repo is dual-licensed. The plugin ships MIT
with the engine credited, unless decided otherwise at publish time.

Engine updates require republishing the plugin and passing review again. That
is the accepted cost of `allowedDomains: ["none"]`.

## Open items

- Icon and cover art: not started, not blocking.
- Whether Generate should offer to bind the selection to the new variables immediately. Deferred until the core loop is proven.

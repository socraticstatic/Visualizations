# Chart Color System Figma Plugin

Design spec. Written 2026-09-14, mockups integrated 2026-09-15.

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
| G5 | Generate chart mockups as editable vectors, and make a bad chart unreachable | JTBD-2, 4, 6 |

G5 is what makes G2 legible. Dash, decal, and shape as variables are abstract
until a five-series line mockup renders with those dashes actually applied.

## Non-goals

- Reading Figma files from outside the plugin. No REST API, no server.
- Writing back to the repo, syncing tokens bidirectionally, or telemetry.
- Multi-tenant or team-level palette storage.
- Binding existing selected nodes to newly written variables. Deferred until the core loop is proven.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Location | `figma/` in this repo, beside `mcp/` | One `PALETTE_VERSION`, one test suite, one source of truth. `mcp/` already proved the in-repo satellite pattern. |
| Engine delivery | Bundled from npm `chart-color-system` | The plugin becomes a real consumer of the public API barrel, like `mcp/` is. It already surfaced a gap: see Prerequisites. |
| Network | `"networkAccess": {"allowedDomains": ["none"]}` | An audit tool that transmits nothing is a better audit tool, and it shortens Community review. Verified as the documented syntax for a plugin making no requests. |
| Engine execution | iframe UI only | The sandbox has no DOM and a restricted runtime. No color math and no chart rendering cross into it. |
| Mockup rendering | ECharts `renderToSVGString()` in the iframe, `figma.createNodeFromSvg()` in the sandbox | Editable Figma vectors, not a raster. All 28 chart kinds come along correctly themed, with decals and dashes intact. Verified: echarts 6.1.0 exposes the method; `createNodeFromSvg` returns a `FrameNode`. |
| Ramp rendering | Discrete piecewise bins, never continuous gradients | `createNodeFromSvg` has documented failures on gradient transforms. The constraint and the dataviz best practice point the same direction. |
| Fixture default | `messy`, not `synthetic` | `fixtures.ts` says synthetic "looks pretty, hides palette weaknesses." A mockup on smooth fake data is how a palette ships broken. Synthetic stays available, labeled. |
| Distribution | Public Figma Community plugin | Best distribution this system will ever get: designers who will never `npm install` anything. |
| Dark on 1-mode plans | Fall back to a second collection | Preserves JTBD-5 on every plan. Cost is branching logic and a clumsier output for free users. |

## Prerequisites

Two pieces of library work gate the plugin. Both are load-bearing. Without
them the plugin would reimplement rules that already exist here, which is how
two copies start disagreeing.

### P1. Grow the public API barrel

Published types today are only `audit`, `constraints`, `encoding`, `palette`,
`version`. Not `bestPractices`, not `chartKinds`, not `builtinBounds`, not
`echartsTheme`. As an npm consumer the plugin currently cannot reach a single
one of the rules that make a chart good.

Add to `src/charts/index.ts`:

- `BEST_PRACTICE`, `type BestPractice` from `bestPractices`
- `type ChartKind`, `CHART_KIND_LABEL` from `chartKinds`
- `safeMaxN`, `clearSafeMaxNCache` from `builtinBounds`
- `getChartTheme` and `type ChartTheme` from `echartsTheme` (the option builder takes a `ChartTheme`, so this is not optional)
- `buildChartOption`, `buildWarningList` from the new `chartOption` (P2)
- the fixture generators and `type DataMode` from `fixtures`

Minor version bump of `chart-color-system`. `README-lib.md` documents the new
surface.

### P2. Extract the option builder out of the demo page

`buildOption(kind, n, chartTheme, dataMode)` already exists at
`src/pages/ChartsDemo.tsx:784`, with `buildWarningList` at line 674, inside a
3,277-line component. The mockup engine is written; it is simply not reachable.

Extract `buildOption`, `buildWarningList`, and their series and data helpers
into `src/charts/chartOption.ts`. `buildOption` is renamed `buildChartOption`
on the way out, since `chartOption.buildOption` reads as a stutter and the
barrel needs an unambiguous name. Signature is otherwise unchanged:
`buildChartOption(kind, n, theme: ChartTheme, dataMode: DataMode)`.

The demo page becomes a consumer. Behavior is unchanged; the existing suite is
the safety net. That file is well past the size where it is doing one thing.

## Architecture

```
figma/
  manifest.json
  package.json          private: true, deps: chart-color-system, culori, echarts
  vite.config.ts        two builds: sandbox (IIFE) + ui (single-file inline)
  src/
    sandbox/
      main.ts           dispatcher only
      variables.ts      applies a VariableSpec[] via the figma API
      selection.ts      walks the selection, delegates to extractFills
      simulate.ts       clones frames, applies a SimulationSpec
      mockup.ts         createNodeFromSvg, places and labels the frame
    shared/
      protocol.ts       message types, the contract between contexts
      spec.ts           buildVariableSpec  (pure)
      fills.ts          extractFills       (pure)
      color.ts          Figma RGB 0..1  <->  engine ColorRecord  (pure)
      gate.ts           effectiveN, refusals, advisories  (pure)
    ui/
      index.html
      App.tsx           four tabs, shared state
  __tests__/            vitest over the pure modules
```

Two contexts, split on capability:

```
iframe UI (React + chart-color-system + echarts)   sandbox (figma API)
  solveCategorical, sequentialRamp  ──write-variables───►  createVariableCollection, setValueForMode
  auditPalette, contrastRatio       ◄─selection-colors───  traverse selection, extractFills
  simulateRgb                       ──render-simulation──►  clone frames, rewrite fills, lay out beside
  buildChartOption, renderToSVGString ──insert-mockup────►  createNodeFromSvg, place, label
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
...through N, where N is the effective N defined under Gating
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
`setPluginData` on the collection, which implements `PluginDataMixin`
(verified), so a re-run updates in place rather than duplicating.

## Gating: never a bad chart

Not a new ruleset. A formula this repo already wrote and already tests, in
`src/charts/__tests__/variantCapInvariant.test.ts`:

```
effective N = min(BEST_PRACTICE[kind].recommendedN, safeMaxN(theme, posture))
```

`shared/gate.ts` is the single pure module that computes it, and every command
routes through it. Four gates:

1. **Kind decides family and posture.** The designer never picks either.
   `bestPractices.ts` states this in its own header comment.
2. **N is clamped by the formula.** The control cannot exceed it. Overflow
   collapses to Top-N plus Other, using the message `buildWarningList` already
   writes.
3. **`warn(n)` advisories render beside the mockup.** Never suppressed, never
   collapsed into a green check.
4. **Refuse, do not silently fix.** A pie at 8 slices is not quietly rendered
   as 5. The plugin states the cap and offers the sorted bar chart, which is
   the exact remedy `bestPractices.ts` already names in its `warn` text.

Gate 4 is the load-bearing one. Silent correction teaches a designer nothing
and leaves them believing the request was honored.

## Commands

Four manifest menu entries, one UI shell, four tabs. State persists across tabs
so a designer can audit a selection, generate a palette that fixes it, and drop
a mockup, without relaunching.

### 1. Generate

Inputs: N, anchor locks, background, sequential/diverging ramp toggles and
steps. Posture is not an input; it comes from the chart kind.

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

### 4. Mockup

Inputs: chart kind (28 available), N, fixture mode (`messy` default), theme.

The kind sets family and posture. `gate.ts` sets effective N and produces any
refusal or advisory, which render before the insert control is enabled. Then
`buildChartOption` builds the option, ECharts renders it to an SVG string, and
the sandbox inserts it via `createNodeFromSvg` with the kind, N, engine
version, and fixture mode in the frame name.

The frame name carries the provenance so a mockup found three months later can
be traced to the configuration that produced it.

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
| `effectiveN` | kind, requested N, theme | clamped N plus which bound applied | `figma`, DOM |
| `gateChart` | kind, requested N, theme | refusal, advisories, effective N | `figma`, DOM |

These carry the real logic and are fully unit-testable with no Figma present.

## Error handling

| Condition | Response |
|---|---|
| `addMode` throws `in addMode: Limited to N modes only` | Write a second collection `Chart Color System Dark` with identical variable names. Explain why in the UI. |
| No selection on Audit or Simulate | Empty state naming the action, not an error toast. |
| Selection has no solid fills | Report what was found (images, gradients, no fills) rather than "0 results". |
| Collection name already exists | Update in place, keyed by `setPluginData`. Never silently duplicate. |
| Solver infeasible | Surface the engine's documented relaxation order. Do not swallow. |
| Requested N above effective N | Clamp, name which of the two bounds applied, offer Top-N plus Other. |
| Kind and N combination is indefensible (pie above 5) | Refuse. State the cap, offer the alternative `bestPractices.ts` names. Insert control stays disabled. |
| Image fill encountered | Refuse with reason. No fabricated number. |
| `createNodeFromSvg` throws | Report the failure with the kind that produced it. Never insert a partial frame. |

## Testing

Vitest in `figma/`, over the pure modules:

- `buildVariableSpec`: schema shape, N clamping, ramp inclusion, both modes, stable naming.
- `extractFills`: mocked node trees covering nesting, opacity compositing, gradient stops, image refusal, non-normal blend modes.
- `color`: round-trip stability across the sRGB boundary and gamut edges.
- `gate`: for all 28 kinds, effective N never exceeds either bound; pie above 5 refuses; every refusal carries an alternative; advisories are never dropped.
- Protocol: every sandbox reply is a valid union member.

Library side, P2 must not change demo behavior. The existing suite plus
`variantCapInvariant.test.ts` is the safety net.

Not unit-tested: the Figma API calls themselves, and SVG fidelity after
`createNodeFromSvg`. Both are covered by the verification bar.

## Verification bar

Plugin development is Figma desktop only. Browser Figma has no
`Plugins -> Development` menu. Figma.app is installed on this machine.

Done means, in Figma desktop:

1. Imported from manifest, all four commands appear.
2. Generate writes the collection; variables are present and correctly valued in both modes.
3. File reloaded; variables survived.
4. Re-running Generate updates in place and does not create a duplicate collection.
5. Audit run against a deliberately bad selection returns failures that match what the engine returns for the same colors.
6. Simulate produces frames that are visibly wrong in the expected way, with originals untouched.
7. Mockup inserts editable vectors, not a raster: a series path is selectable and its stroke dash matches the `chart/series/N/dash` variable.
8. A pie at 8 slices is refused in the UI with the alternative named, and cannot be inserted.
9. The 1-mode fallback exercised, by whatever means available.

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
- Whether Mockup should bind its inserted vectors to the written variables rather than baking hexes. Desirable, deferred: it depends on the core loop being proven first.

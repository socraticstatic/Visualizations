# Chart Color System Figma Plugin

Design spec. Written 2026-09-14. Mockups integrated and licensing resolved
2026-09-15 after three assessment passes; the revision history matters here
because two earlier decisions in this file were wrong and are corrected below.

## Why

The engine is credible in code and invisible in design. A designer mocking a
five-series chart in Figma picks hexes by eye, hands off, and the developer
either honors an unaudited palette or quietly overrides it. Both outcomes lose.

A plugin moves the audited system into the tool where the decision is made.

## Goals

| # | Goal | Serves |
|---|---|---|
| G1 | Generate an audited palette and write it into the file as Figma variables | JTBD-1, 3, 5, 9 |
| G2 | Carry the non-color encodings into Figma alongside color | JTBD-2 |
| G3 | Audit colors already in a file, whether or not they came from this system | JTBD-1, 7 |
| G4 | Render CVD simulations onto the canvas so failure is seen, not read | JTBD-2, 7 |
| G5 | Generate chart mockups as editable vectors, and make a bad chart unreachable | JTBD-2, 4, 6 |

## Non-goals

- Reading Figma files from outside the plugin. No REST API, no server.
- Syncing tokens back to the repo. Telemetry of any kind.
- Multi-tenant or team-level palette storage.
- Binding existing selected nodes to newly written variables. Deferred.

## Corrections to earlier versions of this spec

Recorded because both were approved before being caught, and the second one
dissolved a whole prerequisite.

**C1. Dash, decal, and shape variables are reference values, not bindings.**
`VariableBindableNodeField` has 27 members: height, width, characters,
itemSpacing, four paddings, visible, five radii, min/max width and height,
counterAxisSpacing, five stroke weights, opacity, two grid gaps. No dash field
exists. A STRING variable holding `"6 3"` cannot be bound to a stroke. The
earlier claim that a designer "gets dash patterns that match what the dashboard
will render" is true only of the Mockup command, which bakes them into the
vector. The variables are a labeled reference table. A later feature could
drive a Series component's dash variant from a STRING variable, since variant
properties are bindable, but the plugin does not build that component set.

**C2. Commands 1 through 3 need no library changes at all.**
`solveCategorical` takes `background: ColorRecord`. `auditPalette` takes
`background: ColorRecord`. Both are MIT, pure, and already parameterized on the
background. An earlier version of this spec called the background a hole and
specified a signature refactor plus a token-injection layer to fix it. That was
an artifact of routing through `echartsTheme` and `safeMaxN`, which are
DOM-welded, instead of the MIT functions beside them. The plugin passes the
designer's resolved background directly. No refactor.

What survives of that finding: the audit must resolve the selection's actual
background rather than assume a token, which is a plugin feature, not a
library change.

## Licensing

`LICENSE` currently grants MIT to `index.ts`, `palette/**`, `constraints.ts`,
`encoding.ts`, `audit.ts`, `version.ts`. The Mockup command needs
`chartKinds.ts`, `bestPractices.ts`, `builtinBounds.ts`, `fixtures.ts`, and
`echartsTheme.ts`, none of which are covered.

**Decision: relicense those five files MIT.** The reasoning is that a published
Figma plugin's `code.js` and `ui.html` are readable by anyone who installs it,
per Figma's own developer material. A proprietary label on a readable shipped
bundle is a fiction. Relicensing aligns the label with reality and lets people
legitimately use what they can already read.

**This is not a technical prerequisite.** Micah holds the copyright and can
bundle his own proprietary files into anything he publishes. The plugin ships
either way. The relicense is a decision about honesty and reuse.

**MIT is one-way.** Any version shipped under it stays MIT, and anyone may fork
those rules from that version.

`manualOverrides.ts` stays proprietary. It is 100 lines of demo-app DOM
plumbing that detects whether a React ColorPicker wrote inline styles on
`[data-chart-themed-root]` divs. It is not a rule and has no business in a
library grant. See P0.

Work: update `LICENSE` and `LICENSE-PROPRIETARY`, note the new surface in
`README-lib.md`, bump `chart-color-system` minor.

## Prerequisites

### P0. Cut the proprietary coupling in echartsTheme

`echartsTheme.ts:13` imports `getEditedAnchorIndexes` from
`manualOverrides.ts`, which imports `Theme` back from `echartsTheme.ts`. One
circular pair, one call site, at `echartsTheme.ts:137`.

Thread it as an explicit parameter instead:

```ts
getChartTheme(theme, posture, n, editedAnchorIndexes: number[] = [])
safeMaxN(theme, posture, editedAnchorIndexes: number[] = [])
```

The demo supplies `getEditedAnchorIndexes(theme)` from the top. Default `[]`
is what `builtinBounds` already claims to compute, and the existing tests run
in jsdom with no ColorPicker present, so they resolve to `[]` today.

Result: the five relicensed files have zero proprietary dependencies, and the
library loses a circular import. Worth doing independent of the plugin.

### P1. Barrel export is a separate decision from relicensing

Relicensing makes the five files usable. Exporting them from `src/charts/index.ts`
makes them supported.

Hold the barrel export of `echartsTheme` until `readTokens` accepts injected
tokens. Today it calls `fromCssVar` twenty times against `--chart-bg`,
`--chart-grid`, `--chart-seq-low` and the rest, and the published package ships
no CSS: `dist-lib` is `index.mjs`, `index.cjs`, two maps, `types`, `LICENSE`,
`README`. An npm consumer would import a function that reads twenty custom
properties that do not exist in their app. Publishing that is a support trap.

`chartKinds`, `bestPractices`, `fixtures`, and `builtinBounds` are pure and can
be exported immediately.

The plugin does not need any barrel export. It imports from `src/` by relative
path, in-repo, like the demo does.

### P2. Extract the option builder out of the demo page

`buildOption(kind, n, chartTheme, dataMode)` is at `src/pages/ChartsDemo.tsx:784`
with `buildWarningList` at 674, inside a 3,277-line component.

Extract both plus their series and data helpers into `src/charts/chartOption.ts`,
renaming `buildOption` to `buildChartOption`. Signature otherwise unchanged.

Scope the extraction deliberately: the page imports fourteen chart modules, but
the option builder needs only `chartKinds`, `echartsTheme`, `fixtures`,
`encoding`, `constraints`, and `bestPractices`. `entityPins`, `exportReport`,
and `urlState` are demo concerns and must not come along. Verify by import
list, not assumption.

Behavior unchanged. The existing suite plus `variantCapInvariant.test.ts` is
the safety net.

## Architecture

```
figma/
  manifest.json
  package.json          private: true; echarts, culori
  vite.config.ts        two builds: sandbox (IIFE) + ui (single-file inline)
  src/
    sandbox/
      main.ts           dispatcher only
      variables.ts      applies a VariableSpec[] via the async variable APIs
      selection.ts      walks the selection, delegates to extractFills
      simulate.ts       clones frames, applies a SimulationSpec
      mockup.ts         createNodeFromSvg, places and labels the frame
    shared/
      protocol.ts       message types, the contract between contexts
      spec.ts           buildVariableSpec  (pure)
      fills.ts          extractFills       (pure)
      color.ts          Figma RGB 0..1 <-> engine ColorRecord  (pure)
      gate.ts           effectiveN, refusals, advisories  (pure)
      budget.ts         node-count estimate and refusal  (pure)
  __tests__/
```

Engine code is imported from `../../src/charts/...`, relative and in-repo. The
plugin is not an npm consumer. The MCP server already fills that role.

The engine files use relative imports internally, not the app's `@/` alias, so
the plugin's vite build needs no path aliasing to pull them in.

Two contexts, split on capability:

```
iframe UI (React + engine + echarts)              sandbox (figma API)
  solveCategorical, ramps            ──write-variables───►  createVariableCollection, setValueForModeAsync
  auditPalette, contrastRatio        ◄─selection-colors───  traverse selection, extractFills
  simulateRgb                        ──render-simulation──►  clone frames, rewrite fills, lay out beside
  buildChartOption, renderToSVGString ──insert-mockup─────►  createNodeFromSvg, place, label
```

The sandbox is deliberately dumb. Everything it does is a spec it was handed.

`documentAccess: "dynamic-page"` means the variable APIs are the async
variants. Every signature in `sandbox/variables.ts` is `...Async`.

## Variable schema

One collection, `Chart Color System`, modes `Light` and `Dark`.

```
chart/series/1/color      COLOR    bindable
chart/series/1/dash       STRING   reference only, see C1
chart/series/1/decal      STRING   reference only, see C1
chart/series/1/shape      STRING   reference only, see C1
chart/surface             COLOR    bindable
chart/grid                COLOR    bindable
chart/axis                COLOR    bindable
chart/label               COLOR    bindable
chart/sequential/1..k     COLOR    when requested
chart/diverging/1..k      COLOR    when requested
```

The three STRING variables per slot are labeled in the UI as reference values a
designer types into the stroke panel, not as live bindings. Overstating them is
how the first draft of this spec went wrong.

Collection metadata (engine version, N, posture, seed, anchors) goes in
`setPluginData` on the collection, which implements `PluginDataMixin`, so a
re-run updates in place instead of duplicating.

## Gating: never a bad chart

The formula already tested in `variantCapInvariant.test.ts`:

```
effective N = min(BEST_PRACTICE[kind].recommendedN, safeMaxN(theme, posture))
```

`shared/gate.ts` computes it once and every command routes through it.

1. **Kind decides family and posture.** The designer picks neither.
2. **N is clamped by the formula.** Overflow collapses to Top-N plus Other,
   using the message `buildWarningList` already writes.
3. **`warn(n)` advisories render beside the mockup.** Never suppressed.
4. **Refuse, do not silently fix.** A pie at 8 slices is not quietly rendered
   as 5. State the cap, offer the sorted bar chart `bestPractices.ts` already
   names in its `warn` text, keep the insert control disabled.

Gate 4 is load-bearing. Silent correction teaches nothing and leaves the
designer believing the request was honored.

## Commands

Four menu entries, one UI shell, four tabs, shared state.

### 1. Generate

Inputs: N, anchor locks, background, ramp toggles and steps. Posture comes from
the chart kind, never from the designer.

Background is the designer's, resolved from the selected frame when there is
one and from an explicit control otherwise. It is passed to `solveCategorical`
and `auditPalette` directly. This is the C2 correction in practice.

Solve, show the audit inline, and write only on an explicit second action.
Nothing touches the file until the designer says so.

### 2. Audit

Reads `figma.currentPage.selection`, walks it, calls `extractFills`.

Scope, stated honestly because this is the hardest part of the project:
**v1 audits opaque SOLID fills over a solid resolved parent background.**
Everything else is reported as unaudited with the reason. Specifically:
- Nested multiplying opacity: composited, with the resolved value shown.
- Gradient fills: each stop audited individually, never averaged.
- Image fills: refused. No fabricated number.
- Blend modes other than `NORMAL`: flagged unaudited.
- A parent chain that reaches the canvas without an opaque background: refused,
  because there is no defensible background to audit against.

This plugin makes public accessibility claims under Micah's name. A wrong
green pass is worse than no plugin, so the refusal set is deliberately wide in
v1 and narrows only with tests behind it.

### 3. Simulate

Clones selected frames, rewrites resolved fills through `simulateRgb` for
deutan, protan, tritan, achromatopsia, lays results beside the original with
labels. Originals never mutated.

### 4. Mockup

Inputs: chart kind, N, fixture mode, theme.

`gate.ts` sets effective N and produces refusals or advisories, which render
before the insert control enables. `budget.ts` estimates node count and refuses
above the ceiling found in Spike A. Then `buildChartOption` builds the option,
ECharts renders to an SVG string, and the sandbox inserts via
`createNodeFromSvg`.

Fixtures default to `messy`. `fixtures.ts` says synthetic "looks pretty, hides
palette weaknesses," and a mockup on smooth fake data is how a palette ships
broken. Synthetic stays available and labeled.

Ramps render as discrete piecewise bins, never continuous gradients:
`createNodeFromSvg` has documented gradient-transform failures, and the
dataviz best practice points the same direction.

The frame name carries kind, N, engine version, and fixture mode, so a mockup
found three months later traces to the configuration that produced it.

## Spike A, gating the Mockup command only

Two questions, answered in Figma desktop before Mockup is planned:

1. **Does `<pattern>` survive `createNodeFromSvg`?** ECharts decals render as
   SVG patterns. Figma's import handles geometry, gradients, and masks;
   programmatic references are where it frays. With dash demoted to a
   reference value by C1, decals are the redundancy story in Figma. If patterns
   drop, Mockup needs a different decal strategy, probably tiled vector
   geometry emitted directly.
2. **Where is the node ceiling?** A messy 12-series scatter or a calendar
   heatmap is thousands of paths, and `createNodeFromSvg` is synchronous. The
   answer sets the constant in `budget.ts`.

Commands 1 through 3 do not depend on this spike.

## Pure function contracts

| Function | In | Out | Never touches |
|---|---|---|---|
| `buildVariableSpec` | `SolveResult`, ramps, options | `VariableSpec[]` | `figma` |
| `extractFills` | node tree (mockable) | `ExtractedFill[]` with provenance | `figma` |
| `toFigmaRgb` / `fromFigmaRgb` | sRGB 0..1 <-> `ColorRecord` | round-trip stable | `figma` |
| `gateChart` | kind, requested N, theme | refusal, advisories, effective N | `figma`, DOM |
| `estimateNodes` | kind, N, fixture mode | node estimate, refusal | `figma`, DOM |

## Error handling

| Condition | Response |
|---|---|
| `addMode` throws `in addMode: Limited to N modes only` | Write a second collection `Chart Color System Dark`, identical names. Say in the UI that this preserves the values, not the switching: changing theme means rebinding. It is a consolation prize, not parity. |
| No selection on Audit or Simulate | Empty state naming the action, not an error toast. |
| Selection has no auditable fills | Report what was found and why each was skipped. Never "0 results". |
| Collection exists | Update in place, keyed by `setPluginData`. Never duplicate. |
| Solver infeasible | Surface the documented relaxation order. Do not swallow. |
| Requested N above effective N | Clamp, name which bound applied, offer Top-N plus Other. |
| Kind and N indefensible | Refuse, state the cap, name the alternative. Insert stays disabled. |
| Estimated nodes above ceiling | Refuse with the estimate and the ceiling. Suggest fewer series or synthetic mode. |
| `createNodeFromSvg` throws | Report with the kind that produced it. Never insert a partial frame. |

## Testing

Vitest in `figma/` over the pure modules:

- `buildVariableSpec`: schema shape, clamping, ramp inclusion, both modes, stable naming.
- `extractFills`: mocked trees covering nesting, opacity compositing, gradient stops, image refusal, non-normal blend modes, and the transparent-to-canvas refusal.
- `color`: round-trip stability at the sRGB boundary and gamut edges.
- `gate`: across all 28 kinds, effective N never exceeds either bound; pie above 5 refuses; every refusal carries an alternative; advisories never dropped.
- `budget`: estimates are monotone in N and never under-report.
- `protocol`: every sandbox reply is a valid union member.

**SVG snapshot tests.** 28 kinds by 2 themes by 2 fixture modes is 112
combinations. Snapshot the SVG strings so a token or theme change cannot
silently break every chart at once. Manual verification cannot cover this and
the earlier draft wrongly punted it to the verification bar.

Library side: P0 and P2 must not change demo behavior. The existing suite is
the safety net.

Not unit-tested: Figma API calls, and SVG fidelity after import. Both belong
to the verification bar.

## Verification bar

Plugin development is Figma desktop only; browser Figma has no
`Plugins -> Development` menu. Figma.app is installed on this machine.

Done means, in Figma desktop:

1. Imported from manifest, all four commands appear.
2. Generate writes the collection; variables present and correct in both modes.
3. File reloaded; variables survived.
4. Re-running Generate updates in place, no duplicate collection.
5. Audit against a deliberately bad selection returns failures matching what the engine returns for the same colors and the same background.
6. Audit against an image fill and against a transparent-to-canvas node refuses, with reasons.
7. Simulate produces frames visibly wrong in the expected way, originals untouched.
8. Mockup inserts editable vectors: a series path is selectable, and its decal renders (Spike A permitting).
9. A pie at 8 slices is refused in the UI with the alternative named, and cannot be inserted.
10. A mockup over the node ceiling is refused with the estimate shown.
11. The 1-mode fallback exercised.

"The build succeeded" is not verification.

## Packaging and publishing

Community submission needs an icon (128x128), cover art (1920x960),
screenshots, a tagline, and review, which Figma says may take up to two weeks.

The plugin ships MIT. ECharts is Apache-2.0 and needs a NOTICE; culori is MIT.

Engine updates require republishing and re-review. That is the accepted cost
of `allowedDomains: ["none"]`.

ECharts across 28 kinds is effectively the full build, roughly a megabyte
minified, inlined beside React into one HTML file with no network cache
because the manifest forbids a CDN. That is the deal. Measure the bundle and
record it; if it is unacceptable, the lever is cutting chart kinds, not
loading remotely.

## Ordering

1. P0, the coupling cut. Small, independently valuable.
2. Licensing: `LICENSE`, `LICENSE-PROPRIETARY`, `README-lib.md`.
3. Commands 1 through 3. No prerequisites at all: they use `solveCategorical`,
   `auditPalette`, and `simulateRgb` directly, none of which touch
   `echartsTheme`. P0 is sequenced first only because it is small and
   independently valuable, not because these depend on it.
4. Spike A.
5. P2 extraction, then Command 4.
6. Packaging and submission.

Steps 1 through 3 are one plan. Steps 4 through 6 are a second plan, written
after Spike A answers the pattern question.

## Open items

- Icon and cover art. Not blocking.
- Whether Mockup binds inserted vectors to written variables instead of baking hexes. Desirable; depends on the core loop being proven.
- Whether a later version ships the Series component set that would make the dash STRING variables live bindings via variant properties.

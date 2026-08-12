# Chart Color & Encoding System

By **Micah Boswell** ([socraticstatic](https://github.com/socraticstatic)). Copyright © 2026 Micah Boswell. All rights reserved.

A token-driven, math-backed palette system for ECharts dashboards. Generates categorical, sequential, and diverging palettes that are audited against WCAG contrast, color-vision deficiency (CVD) simulation, and grayscale, and pairs every color slot with a matching dash, decal, and marker shape so meaning survives even when color fails. Honesty note: past ~6 hues, no palette keeps colors reliably distinct under dichromacy — the configured CVD/ΔE floors in `constraints.ts` are deliberately minimal at high N, and the redundant dash/decal/shape encodings are what carry series identity.

> Current version: **0.7.0** (`PALETTE_VERSION` in `src/charts/version.ts`; history in `CHANGELOG.md`).

---

## Jobs To Be Done

**Primary**
- **JTBD-1** — Pick a palette I can defend (contrast + CVD + grayscale audited).
- **JTBD-2** — Charts stay readable for colorblind users (color + dash + decal + shape).
- **JTBD-3** — Same entity stays the same color everywhere.
- **JTBD-4** — Doesn't break when series count changes (graceful Top-N + Other).
- **JTBD-5** — Light and dark mode equally good.
- **JTBD-6** — Right chart-type encoding chosen automatically.
- **JTBD-7** — Prove it works before shipping (live QA harness).

**Secondary**
- **JTBD-8** — Per-user color pin (`localStorage`, scoped by entity ID).
- **JTBD-9** — Brand-locked anchor slots seed the optimizer.
- **JTBD-10** — Surface infeasibility with documented relaxation order.
- **JTBD-11** — Instant theme switch (precomputed cache).
- **JTBD-12** — Stay maintainable (no raw color literals; versioned palette; docs always current).

**Out of scope (named, not built):** multi-tenant solving, SSR/PDF export, telemetry, task-based usability study.

---

## Architecture

```text
  index.css tokens (HSL)
         │
         ▼
  constraints.ts  ──────┐
  brand/semantic locks ─┤
  background + chrome  ─┼──►  optimizer (OKLab + CVD + gamut)
  N + posture          ─┤              │
  reserved slots       ─┘              ▼
                                ordered slot list
                                (color, dash, decal, shape)
                                       │
                                       ▼
                          echartsTheme.ts adapter
                                       │
                                       ▼
                          ECharts components (demo)
                                       │
                                       ▼
                          QA harness (CVD / grayscale / contrast)
```

---

## Deliverables

| # | Deliverable | Serves JTBD |
|---|---|---|
| 1 | Token contract (`src/index.css` + `tailwind.config.ts`) | 1, 5, 9, 12 |
| 2 | Constraint config (`src/charts/constraints.ts`) | 1, 9, 10 |
| 3 | Palette optimizer (`src/charts/palette/`) | 1, 2, 4, 10 |
| 4 | Aligned encoding scales (`src/charts/encoding.ts`) | 2, 3, 6 |
| 5 | ECharts theme adapter (`src/charts/echartsTheme.ts`) | 5, 6, 11 |
| 6 | Demo route `/charts` | 7 |
| 7 | QA harness (CVD / grayscale / contrast / posture / N) | 2, 7, 10 |
| 8 | Test suite | 1, 2, 4, 12 |
| 9 | Override + versioning scaffolding | 8, 12 |
| 10 | This `README.md` | 12 |
| 11 | `CHANGELOG.md` | 12 |

---

## Tiers

### Tier 1 — Tokens & constraints
Semantic chart tokens in `index.css` (HSL, light + dark): surfaces, neutrals, status, anchors, states. Tailwind `chart` color group exposes them. `constraints.ts` defines ΔE thresholds, posture presets (`kpi`, `comparative`, `exploratory`), Top-N + Other overflow, and constraint-relaxation priority.

### Tier 2 — Optimizer & encoding scales
- `palette/cvd.ts` — Machado 2009 deutan/protan/tritan matrices.
- `palette/distance.ts` — OKLab ΔE + worst-of-three CVD ΔE.
- `palette/gamut.ts` — chroma-reduction gamut mapping into sRGB.
- `palette/categorical.ts` — seeded farthest-point + simulated-annealing maximin solver.
- `palette/ramps.ts` — monotonic-L OKLCH sequential and diverging ramps.
- `palette/assignment.ts` — bipartite stable assignment when N changes.
- `encoding.ts` — `dashScale`, `decalScale`, `shapeScale` indexed 1:1 with color.

### Tier 3 — Adapter, demo, lifecycle
- `echartsTheme.ts` reads CSS vars at runtime and emits an ECharts theme + helpers (`buildLineSeries`, `buildBarSeries`, `buildVisualMap`).
- `components/charts/EChart.tsx` wraps `echarts-for-react` with atomic theme swap.
- `/charts` is a **constrained palette builder** beside the chart preview: chart type, N, theme, vision preview, and fixtures are controlled from one place. Posture, palette family, and ramp shape are derived. The default N snap is capped to the runtime-probed safe max so out-of-the-box palettes clear every configured ΔE / CVD floor and WCAG 3:1 contrast with zero solver relaxations; the slider can be dragged past the safe cap into an educational range where the audit panel shows exactly which floors break.
- Every render runs the accessibility audit (`audit.ts`): per-vision OKLab ΔE (normal + deutan + protan + tritan + achromatopsia) against per-mode thresholds, plus WCAG 2.2 SC 1.4.11 (≥ 3:1) contrast vs. background. Result is shown as a `pass` / `warn` / `fail` badge with per-vision detail.
- `setEntityColor(entityId, slotIndex)` persists per-user pins in `localStorage`.
- `PALETTE_VERSION` aligns with `CHANGELOG.md`.

---

## Run

```bash
npm install
npm run dev
```

Then open the preview and navigate to **`/charts`**.

### Tests

```bash
npx vitest run
```

Covers the palette primitives (`stableAssign`, `sequentialRamp` L-monotonicity, `divergingRamp` length, aligned encoding scales), `solveCategorical` property tests across N=2..8 (determinism, in-gamut sRGB, threshold-or-relaxation contract, lock-honoring), entity pins (permutation safety, collision bumping, paired remap of color/dash/decal/shape), URL state round-trips, and fixture determinism + messy-mode characteristics (nulls on lines, missing heatmap cells, diverging outliers).


### Reading the accessibility harness
- **Overall verdict**: `pass` (all modes pass + WCAG ≥ 3:1), `warn` (≤ 1 vision mode fails, contrast still passes), or `fail`.
- **Per-vision tiles**: minimum pairwise ΔE under each simulation, vs. the configured threshold. Note the CVD and normal-vision thresholds (`constraints.ts`) are deliberately low floors, not perceptual guarantees — they exist to catch outright collisions while the dash/decal/shape scales carry identity at high N.
- **Worst contrast vs. background**: WCAG 2.2 SC 1.4.11 ratio for non-text marks; threshold ≥ 3:1.
- **Best-practice rationale**: one-line explanation of why this chart type has its specific limits, plus per-N warnings (e.g. "Pie charts above 5 slices misrepresent magnitudes").

### Exporting a palette

The green **Export palette** button on `/charts` opens a tabbed dialog with five emitters from `src/charts/paletteExport.ts`:

- **CSS variables** — `:root` (or `.dark`) block with `--chart-bg`, `--chart-cat-N`, `--chart-seq-N`, `--chart-div-N`, plus semantic positive/negative. When Compare is on with normal vision, Variant B is emitted under `[data-chart-variant="b"]`.
- **Tailwind config** — `chart.cat/seq/div` map that references the CSS vars above, paste-ready under `theme.extend.colors`.
- **ECharts theme** — full `registerTheme` payload (color, backgroundColor, axis/legend/tooltip, sequential + diverging `visualMap` ramps).
- **Figma Tokens** — Tokens Studio / W3C-style JSON with `chart.{surface,semantic,categorical,sequential,diverging}` and `$metadata.generator`.
- **SVG swatches** — single-page printable sheet labeled with hex + slot index.

The **Export audit report** button (next to it) still produces the standalone HTML audit (charts + warnings + accessibility metrics, single-variant or A vs. B).

### Palette builder

The only active builder controls live beside the chart preview. They update the rendered chart immediately, clamp N to the safe built-in range for the selected kind/theme, and clear any stale inline token overrides on load so built-in palettes remain compliant.

### Coach tour

A coach tour auto-opens on first visit (`localStorage["chart-tour-seen-v1"]`) and walks through the chart-side builder controls and export flow. Replay it anytime via **Take the tour** in the page header.

### Presets

The **Presets** panel ships 6 curated starters ("Finance KPI", "Analytics exploratory", "Board / comparative", "Marketing share", "Ops heatmap", "Variance / diverging") and lets you save your own named `(kind, n, theme)` configurations under `localStorage["chart-palette-presets-v1"]`. Color overrides are stored separately so presets stay solver-stable across palette updates. The **Compare presets** sub-panel lets you pick any two (curated, user, or the live builder state) and shows a side-by-side diff of chart kind, family, posture, N, recommended N, max N, and theme — differing rows highlighted in warning tint, ⚠ flags N above the kind's recommended ceiling.

### Entity pins

The **Entity pins** panel (categorical charts) lets you lock a series to a specific slot — color, dash, decal, and shape together — so the same entity keeps the same identity across filters, reloads, and dashboards. "Auto" means "let the solver assign the next free slot in order"; picking `Slot k` writes the pin to `localStorage["chart-entity-color-pins-v1"]` via `setEntityColor`. Collisions (two entities pinning the same slot) are auto-resolved — the later entity is bumped to the next free slot and listed under "Collisions". Implements JTBD-3 ("keep the same entity the same color everywhere").

### Benchmark vs. published systems

For categorical charts, a **Benchmark vs. published systems** table scores the current solver palette next to Tableau 10, IBM Carbon Categorical, ColorBrewer Set2, Observable 10, and Material 700 — using identical math (min pairwise ΔE in OKLab, worst-of-three CVD ΔE, worst contrast vs. *your current background*). ★ marks the winner per column.

### Density preview

For categorical charts, the **Density preview** renders every slot at realistic chart-element sizes (11px legend swatch, 2px line stroke, 4px bar, 8px scatter dot, deterministic sparkline) against the active background — so you catch slots that vanish at small sizes before shipping.

### Copy decision rationale

The **Copy rationale** button inside the Explain panel copies a paragraph-formatted decision summary (inputs · family · posture · N · solver/ramp note · relaxations · accessibility verdict) to the clipboard, ready to paste into a PR, ticket, or design spec.

### Shareable deep links

The **Copy share link** button (next to Export) writes the current builder configuration — chart kind, N, theme, vision, compare flag, and Variant B — into the URL hash and copies a permalink to your clipboard. Anyone who opens the link lands on the exact same configuration. Brand-anchor color overrides stay per-user in `localStorage` and are intentionally excluded from the link.

### Ready-to-paste code snippet

For categorical charts, the **Ready-to-paste React + ECharts snippet** panel emits a self-contained `<KindChart>.tsx` component with the audited palette, dashes, decals, shapes, and chrome tokens baked in. It depends only on `echarts` + `echarts-for-react` — no design-tool runtime — so engineers can ship the chart without adopting the whole token system. Show/hide, copy, or download as `.tsx`.

### Semantic role audit

For categorical charts, the **Semantic role audit** scores each semantic token (`positive`, `negative`, `target`, `forecast`, `muted`, `other`) for WCAG ≥ 3:1 contrast vs. the chart background *and* for collisions with the current categorical palette under both normal and CVD vision. Surfaces the silent failure where a "positive" green KPI bar blends into a categorical series for deutan/protan viewers.

### Vision matrix

The **Vision matrix** renders the current chart five times side-by-side — normal, deuteranopia, protanopia, tritanopia, and grayscale — using the same SVG color-matrix filters that back the single-mode preview. Scan all five at once instead of toggling, and you'll see immediately which series collapse for any audience.

### Glossary

The collapsible **Glossary** panel at the bottom of `/charts` defines every term the tool surfaces (ΔE, OKLab, CVD, WCAG 2.2 SC 1.4.11, posture, anchor, decal, dash, shape, relaxation, Top-N + Other, stable assignment), each with a plain-language summary, a longer explanation, and a pointer to the source file that implements it.

### Emphasis preview

For line, step-line, area, stacked-area, bar, stacked-bar, grouped-bar, and horizontal-bar kinds, the **Emphasis preview** lets you pick a hero series and renders the chart with that slot at full chroma while every other series collapses to `--chart-muted`. Use to verify the storytelling pattern (one entity in focus, the rest as context) holds up under the audited palette before handing the chart to engineering.

### Insight callouts

For categorical charts, **Insight callouts** auto-generates plain-English observations about the palette's *shape*: most and least saturated slots (with multiplier vs. the average), hue families covered, tightest CVD pair, tightest normal-vision pair, tightest contrast-vs-background slot, and OKLab lightness spread (grayscale-survival proxy). Descriptive, not prescriptive.

### Messy / realistic fixtures

The **Fixtures** toggle in the palette builder (synthetic / messy) swaps the underlying data behind line / step-line / area / stacked-area / bar / stacked-bar / grouped-bar / horizontal-bar / heatmap / diverging-bar / diverging-heatmap. **Synthetic** is smooth sine/cosine data with no missing values, ties, or outliers — pretty, and hides palette weaknesses. **Messy** mirrors real dashboards: long-tail magnitudes (first series dominates), one near-zero "dead" series, one spiky outlier series, ~6 % missing values, heavy hot spots + missing cells in heatmaps, and extreme outliers + near-midpoint ties in diverging. Both modes are deterministic via a seeded PRNG, so the same configuration always renders the same fixture. Use it to test palettes against the patterns that actually break them (near-zero stacks vanishing, tied middle series becoming indistinguishable, near-midpoint diverging cells merging into the ramp midpoint).





---



## Documentation maintenance contract

Every change in this project must, in the same change:

1. Update `README.md` if scope, architecture, deliverables, JTBD, dependencies, or run/usage changes.
2. Add an entry under `## [Unreleased]` in `CHANGELOG.md` (`Added` / `Changed` / `Fixed` / `Removed` / `Security`).
3. Bump `PALETTE_VERSION` if constraints, anchors, or optimizer behavior change in a user-visible way.

This rule is persisted to project memory (`mem://index.md`).

---

## Tech notes

- Dependencies: `culori`, `echarts`, `echarts-for-react`.
- Client-side only.
- OKLab for math, HSL for CSS, hex/rgba into ECharts via the adapter.
- Seeded PRNG → reproducible palettes.
- Solver runs once per `(theme, posture, N)` at module init; cached.

---

## Sponsor

If this system saves you a week of arguing about chart colors, you can support the
work here: **[github.com/sponsors/socraticstatic](https://github.com/sponsors/socraticstatic)**

---

## License

Copyright © 2026 **Micah Boswell**. Dual-licensed — see [`LICENSE`](LICENSE).

**The palette engine is MIT** ([`LICENSE-MIT`](LICENSE-MIT)): `src/charts/index.ts`,
`src/charts/palette/**`, `constraints.ts`, `encoding.ts`, `audit.ts`, `version.ts`.
It ships to npm as [`chart-color-system`](https://www.npmjs.com/package/chart-color-system).
Palettes and tokens you generate with it — including anything from Export or
Copy-snippet — are yours, no attribution required.

**Everything else is proprietary** ([`LICENSE-PROPRIETARY`](LICENSE-PROPRIETARY)): the
React application, its UI components, the demo harness, and the written content. No part
may be copied, modified, or distributed without express written permission.

### Building the package

```bash
npm run build:lib     # → dist-lib/, an MIT-licensed, publishable package
```

The published version tracks `PALETTE_VERSION`, not the app version: a version bump
means the colors may have moved.

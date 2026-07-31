# Navigation rebuild + text-contrast fix

**Date:** 2026-07-31
**Baseline:** `60c5725`
**Status:** approved design, not yet implemented

## Problem

The glossary sits at the bottom of an 8.1-screen page and nobody finds it. That is
the symptom. Three measured causes:

Two viewports are cited below. Screen positions in the next table were measured at
1600x720 (page height 5,687px = 7.9 screens). The 8.1-screen figure is 1280x800
(6,454px), where narrower columns wrap more. Both are real; neither is a typo.

**1. The same audit verdict is printed five times.** At N=2, Line, light theme:

| Panel | Screen | Prints |
| --- | --- | --- |
| Builder ribbon | 0.4 | pass/fail in prose |
| `AccessibilityHarness` | 1.2 | `NORMAL ΔE 47.0` |
| `VisionMatrix` caption | 1.8 | `MIN ΔE (NORMAL) 47.0 · WORST CVD 27.7` |
| `BuilderAuditStatus` | 6.5 | `ΔE 47.0 clearly distinct · WCAG 4.81:1` |
| `AuditSummaryCard` | 7.0 | `MIN ΔE (NORMAL VISION) 47.0 · WCAG 4.81:1` |

Two permutation sweeps also stack: `AutoAuditSummary` (12 permutations) sits directly
above `FullPermutationAudit` (374), and the 12 are a subset of the 374. The rationale
paragraph "Lines must be distinguishable in both color and dash…" renders three times
verbatim. Page total at N=2 with lazy panels unmounted: 1,660 words, `ΔE` 61 times.

The page was not badly navigated. It accreted. `BuilderAuditStatus`'s own docstring says
it "lives next to the builder controls"; it renders at screen 6.5 while the controls are
at 0.4. It drifted, and each landing spot grew a fresh restatement.

**2. Two screens of content are unreachable from the nav.** The block between
`flow-ship` and `flow-reference` has no `id`, no heading, and no stepper pill.

**3. The stepper misrepresents the page.** Seven pills point into one
`<section id="flow-build">`. `flow-verify` and `flow-reuse` render with no heading at all.
Section position is not shareable: `ShareLink` owns `location.hash`, so the stepper must
`preventDefault()` and fake the jump.

### Separately: 111 text-contrast failures

Measured in light theme at 1280x800 with transitions disabled. Reduces to four pairs:

| Color used as text | Instances | Ratio | Needs |
| --- | --- | --- | --- |
| `rgb(37,147,95)` positive green | 89 | 3.65 - 3.88 | 4.5 |
| `rgb(13,128,242)` info blue (incl. white-on-blue) | 11 | 3.67 - 3.90 | 4.5 |
| `rgb(100,116,139)` slate-500 | 9 | 4.48 | 4.5 |
| white on teal / gray badges | 2 | 3.25, 3.29 | 4.5 |

One systemic cause: semantic chart tokens are tuned to clear 3:1 as chart marks
(WCAG 2.2 SC 1.4.11), then reused as 10-12px UI text, which needs 4.5:1 (SC 1.4.3).
39 failures are at 10-11px. The active nav pill is one of the eleven, so a new nav built
on the current token ships a known defect.

Also measured: 11 interactive controls below the 24x24 minimum (SC 2.5.8) - two
checkboxes at 13x13, six preset buttons 16px tall, two selects and one button at 22px.
The 7-pill nav wraps to 103px of sticky chrome at 754px wide.

### Measurement note

`transition-colors` plus CSS-variable theming leaves `getComputedStyle().color` stale
indefinitely after a theme flip, not just for the transition duration. Every contrast
reading must be taken with transitions disabled:

```js
const s = document.createElement('style');
s.textContent = '*,*::before,*::after{transition:none !important;animation:none !important}';
document.head.appendChild(s);
```

Without this, sweeps report phantom failures (measured 1.06:1 and 2.49:1 values in dark
theme that settle to 7.63:1 and 8.19:1). Dark theme currently passes. The token audit in
`src/charts/audit.ts` reads tokens rather than computed styles and is unaffected.

## Non-goals

- No change to palette math, solver, or any `src/charts/palette/*` module.
- No change to `exportReport.ts`. It builds standalone HTML from data and never scrapes
  the DOM, so restructuring the page cannot affect exports.
- Not deleting `FullPermutationAudit`. It serves a distinct audience (see below).
- Not converting sections to tab panes. Discovery is the complaint; tabs hide by default.

## Design

### Two audiences, two homes

Nothing appears in both.

**Builder surface - pinned, never scrolls away.** Chart, vision toggle, and one verdict.

**Evidence section - proof for a reviewer.** The sweeps and matrices.

### Component changes

| Action | Components | Result |
| --- | --- | --- |
| Merge | `BuilderAuditStatus` + `AuditSummaryCard` + `AccessibilityHarness` | `PaletteVerdict` |
| Merge | `AutoAuditSummary` + `FullPermutationAudit` | `SystemAudit` |
| Move | `VisionMatrix`, `BenchmarkPanel` | into Evidence |
| Move | `Glossary`, `ExplainPanel` | into a global drawer |
| Delete | 2 of 3 rationale paragraph copies | - |
| Delete | `FlowStepper` (7 pills) | replaced by `SectionNav` (4) |

`PaletteVerdict` collapsed is one ~72px row: status chip, WCAG ratio vs background,
min ΔE normal / worst CVD, relaxation count. Expanded it shows the per-mode breakdown
(deutan / protan / tritan / mono) and the warnings list. It is the entire builder
audience, always on screen. Verify stops being a destination.

`SystemAudit` carries a scope toggle: **This chart type** (12 permutations) /
**Everything** (374). The first is the old `AutoAuditSummary`, now a filtered default
rather than a separate panel.

### Sections

Four, each with a real `<h2>`:

1. **Evidence** - `VisionMatrix`, `SemanticRoleAudit`, `SystemAudit`, `BenchmarkPanel`
2. **Storytell** - `InsightCallouts`, `EmphasisPreview`, `DensityPreview`
3. **Reuse** - `PalettePresets`, `WorkflowPresets`, `EntityPins`
4. **Ship** - `CodeSnippet`, `ExportPalette`, `ShareLink`

Reference is not a section. It is a drawer reachable from every section.

### Layout, desktop >= 1024px

```
+-- sticky, 48px --------------------------------------------------+
| [mark]  Evidence · Storytell · Reuse · Ship     Glossary  Share ⤓ |
+---------------------------+--------------------------------------+
| sticky, top-14            | page scroll                          |
|   chart                   |   controls                           |
|   vision toggle           |   -- Evidence -------------------    |
|   PaletteVerdict  <-------+-- never leaves the screen            |
|                           |   -- Storytell ------------------    |
|                           |   -- Reuse ----------------------    |
|                           |   -- Ship -----------------------    |
+---------------------------+--------------------------------------+
```

Global actions and section nav share one 48px bar. The page title block scrolls away.
No "Home" breadcrumb (removed deliberately in a prior pass; do not reintroduce).

**The sticky column must fit 720px.** Budget after bar and padding is 656px. Today's
fixed 560px chart plus toggle plus verdict is ~740px, which pushes the verdict off screen.
So the chart flexes:

```css
height: clamp(300px, calc(100dvh - 260px), 560px);
```

At 720px viewport the chart is 460px and the verdict is visible by construction, not by
luck. At >= 820px viewport it reaches its 560px cap.

**Page scroll, not a nested scroll container.** Required so `CoachTour`'s
`scrollIntoView` stays predictable and Cmd+F keeps working.

### Scrollspy

Current implementation picks the section with the highest `intersectionRatio`
(`FlowStepper.tsx:36`), so a tall section stays lit while a short one below is being read.
Evidence will be the tallest section, so this matters. Replace with: **the last section
whose top has crossed the threshold line wins.**

### URL state

Add an optional `s` key to `urlState.ts` alongside `k,n,t,v,c,kb,nb,tb`.

- Clicking a section writes `s=evidence` and smooth-scrolls.
- Scrollspy updates the pill only and never writes the hash, so scrolling does not
  destroy the back button.
- On load, `s` scrolls to that section after mount.

Section position becomes shareable, which it is not today.

### Compare mode

Two charts cannot both pin. When `compare` is on, chart pinning turns off and
`PaletteVerdict` becomes a slim sticky bar under the app bar showing A and B side by
side. The charts scroll; the verdicts do not.

### Linear path

`NextStageButton` stays, retargeted to the four sections. A first-timer sets the controls
then walks Evidence -> Storytell -> Reuse -> Ship without choosing. A returning user
clicks any pill. Neither is trapped.

### Responsive, below 1024px

- Single column. The chart becomes a sticky collapsible header: ~38vh expanded,
  collapsing on scroll to a 72px strip carrying a chart thumbnail and the verdict chip.
- The nav never wraps: four pills, one row, `overflow-x: auto` with scroll-snap, fixed
  44px. Four items cannot wrap where seven did.
- Target sizes: 24x24 floor everywhere (SC 2.5.8 AA), raised to 44x44 under
  `@media (pointer: coarse)`. Covers the 13x13 checkboxes, the six 16px preset buttons,
  and the three 22px controls.

**Unverified:** the preview pane would not go below 754px wide, so true phone behavior is
designed but not yet measured. Must be verified before this ships.

### Reference drawer and inline terms

A `<Term>` component: real `<button>`, dotted underline, popover carrying the existing
one-line `short` from `Glossary.tsx`, with "Full definition" opening the drawer at that
entry. Wrapped on **first occurrence per panel**, not all 61 instances of `ΔE`.

The drawer is `role="dialog"` with `aria-modal`, focus-trapped, Esc to close, focus
restored on close, opened from the header button or the `?` key.

### Accessibility

- The section nav is a `<nav>` with `aria-current="true"` on the active link. **Not** a
  tablist - sections are scroll-anchored, so tab semantics would misreport content
  swapping to screen readers.
- Skip link to main content. None exists today.
- `prefers-reduced-motion` honored on section scrolling and on `CoachTour.tsx:90`, whose
  `scrollIntoView` is unconditionally `behavior: "smooth"` today.

### Token fix

Introduce text-safe variants of the semantic tokens, separate from the mark tokens:

- `--chart-positive-text`, `--chart-info-text`, `--chart-negative-text`, each >= 4.5:1
  against `--chart-surface`, `--chart-bg`, and `--page-bg` in both themes.
- Mark tokens keep their 3:1 tuning. That is correct for marks.
- Replace slate-500 (4.48:1) at its 9 sites.
- Raise the two badge pairs (white on teal 3.25:1, white on gray 3.29:1).

Roughly 100 instances, one pair of tokens.

### CoachTour

All four `data-tour` anchors keep their attributes on the same semantic elements, so
`STEPS` needs no change: `chart-kind` and `n-slider` stay in the controls column,
`vision-preview` moves into the pinned column, `export-palette` stays in Ship.

`CoachTour` measures with `getBoundingClientRect()` and re-measures on capture-phase
scroll, resize, and a 400ms tick, so a sticky ancestor is safe. Do not introduce a
`transform` on any ancestor of an anchor.

## File-level plan

`ChartsDemo.tsx` is 3,080 lines and cannot be edited safely at that size. Extract:

- `src/components/charts/PaletteVerdict.tsx` (new)
- `src/components/charts/SystemAudit.tsx` (new)
- `src/components/charts/SectionNav.tsx` (new, replaces `FlowStepper.tsx`)
- `src/components/charts/ReferenceDrawer.tsx` (new; absorbs `Glossary`, `ExplainPanel`)
- `src/components/charts/Term.tsx` (new)
- `src/components/charts/sections/{Evidence,Storytell,Reuse,Ship}.tsx` (new)

Deleted files: `BuilderAuditStatus.tsx`, `AuditSummaryCard.tsx`, `AutoAuditSummary.tsx`,
`FlowStepper.tsx`, `Glossary.tsx`.

`AccessibilityHarness` is defined inside `ChartsDemo.tsx`, not its own file; its markup
moves into `PaletteVerdict`'s expanded state and the local definition is removed.
`Glossary.tsx`'s `ENTRIES` array moves verbatim into `ReferenceDrawer.tsx` and is the
single source for both the drawer list and `<Term>` popovers.

## Testing

Unit (`npx vitest run`, baseline 1,772 green):

- `urlState`: `s` round-trips; absent `s` decodes clean; unknown `s` value ignored.
- `PaletteVerdict`: given an audit result, renders one verdict; expanded state lists all
  four CVD modes.
- `SystemAudit`: scope toggle filters 374 -> 12 for the current kind/theme.
- Token contrast: assert each `*-text` token clears 4.5:1 against all three backgrounds
  in both themes. This is the regression guard for the whole class of bug.

Browser verification, required before "done":

1. Contrast sweep with transitions disabled, both themes, at 1280x800. Expect 0 failures.
2. Target-size sweep. Expect 0 controls below 24x24.
3. Verdict visible at 1280x720 at every scroll position, both compare modes.
4. Page height re-measured. Target under 6 screens, down from 8.1.
5. Coach tour walks all four steps and highlights track their anchors.
6. Phone width. Blocked until the pane can go below 754px; find another route.

## Risks

- **Chart shrinks to 460px at 720px viewport.** Real cost on a 13" laptop, accepted to
  keep the verdict pinned. Revisit if it reads badly.
- **Losing Cmd+F across all content** is avoided by staying scroll-anchored rather than
  tabbed. If sections later become panes, this returns.
- **Phone layout unverified.** Listed as a blocker above, not a footnote.

## Open

- Whether the 11 undersized targets ship with this change or separately. Included here;
  say the word to split.

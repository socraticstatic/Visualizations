# Nav Rebuild + Text-Contrast Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse five duplicated audit panels into one pinned verdict plus one scoped sweep, replace seven fake stepper pills with four real sections, move the glossary into a reachable drawer, and fix 111 text-contrast failures at their token source.

**Architecture:** Two audiences get two homes. The builder audience gets a `PaletteVerdict` pinned beside the chart that never scrolls away, so "is this palette safe?" is answered without travel. The reviewer audience gets an Evidence section holding the sweeps. Navigation stays scroll-anchored (not tabbed) so discovery and Cmd+F survive. Contrast is fixed by adding text-safe token variants rather than patching call sites, with a unit test as the regression guard.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, shadcn/Radix, ECharts, Vitest, culori.

**Spec:** `docs/superpowers/specs/2026-07-31-nav-and-contrast-design.md`

## Global Constraints

- **npm only.** `npm install`, `npm run dev`, `npx vitest run`. Never reintroduce bun or `bun.lockb`.
- **Never reintroduce the scrubbed scaffolding vendor's name** in any file or commit message. History was rewritten to remove it.
- **Stage files explicitly.** Never `git add -A` or `git add .`. `docs/PLAN-chart-color-audit.md` is Micah's private business plan in a public repo. It is now gitignored, but stage by path regardless.
- **Baseline is 1,772 tests green.** Run `npx vitest run` before every commit. Never commit red.
- **No "Home" breadcrumb.** It was deliberately removed in a prior pass.
- **No em dashes in UI copy.** Use hyphens or rephrase.
- **The four `data-tour` attributes must survive** on the same semantic elements: `chart-kind`, `n-slider`, `vision-preview`, `export-palette`. `CoachTour.tsx` STEPS must not need editing.
- **No `transform` on any ancestor of a `data-tour` anchor.** It breaks the tour's rect math.
- **Page scroll only.** No nested `overflow-y: auto` container for sections.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/components/charts/PaletteVerdict.tsx` | Single live verdict for the current palette; collapsed row + expanded CVD detail |
| `src/components/charts/SystemAudit.tsx` | Permutation sweep with scope toggle (this kind / everything) |
| `src/components/charts/SectionNav.tsx` | Four-pill sticky nav with corrected scrollspy |
| `src/components/charts/ReferenceDrawer.tsx` | Glossary entries + decision rationale in a dialog |
| `src/components/charts/Term.tsx` | Inline term with definition popover |
| `src/components/charts/sections/Evidence.tsx` | Section 1 wrapper |
| `src/components/charts/sections/Storytell.tsx` | Section 2 wrapper |
| `src/components/charts/sections/Reuse.tsx` | Section 3 wrapper |
| `src/components/charts/sections/Ship.tsx` | Section 4 wrapper |
| `src/charts/glossary.ts` | `ENTRIES` moved out of `Glossary.tsx`; single source for drawer and `<Term>` |
| `src/charts/__tests__/tokenContrast.test.ts` | Regression guard for the whole contrast bug class |
| `src/charts/__tests__/sections.test.ts` | Section id/label constants stay in sync |

**Deleted:** `BuilderAuditStatus.tsx`, `AuditSummaryCard.tsx`, `AutoAuditSummary.tsx`, `FlowStepper.tsx`, `Glossary.tsx`.

**Modified:** `src/index.css` (tokens), `tailwind.config.ts` (token mappings), `src/charts/urlState.ts` (`s` key), `src/pages/ChartsDemo.tsx` (assembly; `AccessibilityHarness` and `ExplainPanel` are defined inline here and get extracted), `src/components/charts/CoachTour.tsx` (reduced-motion only).

**Task order rationale:** Tokens first because the nav uses the token that currently fails. `urlState` second because `SectionNav` consumes it. Components before assembly. Verification last.

---

### Task 1: Text-safe color tokens

The systemic bug: semantic tokens are tuned to clear 3:1 as chart marks (WCAG 2.2 SC 1.4.11), then reused as 10-12px UI text, which needs 4.5:1 (SC 1.4.3). Add text-safe variants. Mark tokens keep their 3:1 tuning because that is correct for marks.

**Files:**
- Create: `src/charts/__tests__/tokenContrast.test.ts`
- Modify: `src/index.css` (light block ends line ~95, dark block ~140-175)
- Modify: `tailwind.config.ts:63-82`

**Interfaces:**
- Consumes: `fromCss` from `src/charts/palette/distance.ts` (signature: `fromCss(css: string): ColorRecord`), `contrastRatio` from `src/charts/audit.ts` (signature: `contrastRatio(a: ColorRecord, b: ColorRecord): number`)
- Produces: CSS vars `--chart-positive-text`, `--chart-negative-text`, `--chart-info-text`, `--chart-info-strong`, `--chart-muted-text`. Tailwind classes `text-chart-positive-text`, `text-chart-negative-text`, `text-chart-info-text`, `bg-chart-info-strong`, `text-chart-muted-text`.

- [ ] **Step 1: Write the failing test**

Create `src/charts/__tests__/tokenContrast.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fromCss } from "@/charts/palette/distance";
import { contrastRatio } from "@/charts/audit";

/**
 * Regression guard for the text-contrast bug class.
 *
 * Semantic chart tokens are tuned to clear 3:1 as chart marks (WCAG 2.2
 * SC 1.4.11). Reusing them as small UI text needs 4.5:1 (SC 1.4.3). A
 * measured sweep on 2026-07-31 found 111 failures from exactly this.
 * These assertions pin the *-text tokens so it cannot recur.
 *
 * Parsed from index.css rather than the DOM: jsdom does not resolve custom
 * property inheritance from stylesheets, and the declared value is the thing
 * we actually want to guard.
 */
const CSS = readFileSync(resolve(__dirname, "../../index.css"), "utf8");

/** Extract a token's triplet from the `:root` (light) or `.dark` block. */
function token(name: string, theme: "light" | "dark"): string {
  // The light block is `:root {...}`; the dark block is `.dark {...}`.
  const blockRe = theme === "light" ? /:root\s*\{([\s\S]*?)\n\s*\}/g : /\.dark\s*\{([\s\S]*?)\n\s*\}/g;
  for (const m of CSS.matchAll(blockRe)) {
    const hit = m[1].match(new RegExp(`--${name}:\\s*([^;]+);`));
    if (hit) return hit[1].trim();
  }
  throw new Error(`token --${name} not found in ${theme} block`);
}

const rec = (name: string, theme: "light" | "dark") => fromCss(`hsl(${token(name, theme)})`);

/** Every surface a piece of UI text can sit on, per theme. */
const BACKGROUNDS = ["chart-bg", "chart-surface", "page-bg"] as const;

/** Tokens used as small text. Each must clear 4.5:1 on every background. */
const TEXT_TOKENS = [
  "chart-positive-text",
  "chart-negative-text",
  "chart-info-text",
  "chart-muted-text",
] as const;

describe("text-safe tokens clear WCAG 1.4.3 on every surface", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const name of TEXT_TOKENS) {
      for (const bg of BACKGROUNDS) {
        it(`${theme}: --${name} on --${bg} >= 4.5:1`, () => {
          const ratio = contrastRatio(rec(name, theme), rec(bg, theme));
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

describe("selected-control fill carries readable text", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`${theme}: --chart-info-strong against its own foreground >= 4.5:1`, () => {
      // Selected pills paint text in --chart-bg on a --chart-info-strong fill.
      const ratio = contrastRatio(rec("chart-info-strong", theme), rec("chart-bg", theme));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("mark tokens keep their 3:1 mark tuning", () => {
  it("light: --chart-positive still clears 3:1 as a mark", () => {
    // Guards against someone 'fixing' contrast by darkening the mark token,
    // which would change every chart. Marks need 3:1, not 4.5:1.
    const ratio = contrastRatio(rec("chart-positive", "light"), rec("chart-bg", "light"));
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/charts/__tests__/tokenContrast.test.ts`
Expected: FAIL with `token --chart-positive-text not found in light block`

- [ ] **Step 3: Add the tokens**

In `src/index.css`, inside the `:root` block next to the existing `--chart-positive` (line ~74), add:

```css
    /* Text-safe variants. Mark tokens above are tuned for SC 1.4.11 (3:1);
       these clear SC 1.4.3 (4.5:1) for 10-12px UI text. Do not merge them. */
    --chart-positive-text: 152 60% 30%;
    --chart-negative-text: 0 72% 40%;
    --chart-info-text: 210 90% 38%;
    --chart-muted-text: 215 19% 35%;
    --chart-info-strong: 210 90% 42%;
```

In the `.dark` block next to the existing `--chart-positive` (line ~155), add:

```css
    /* Dark theme already clears 4.5:1 for these hues; the variants exist so
       call sites can reference one name across both themes. */
    --chart-positive-text: 152 65% 50%;
    --chart-negative-text: 0 75% 60%;
    --chart-info-text: 210 95% 65%;
    --chart-muted-text: 215 20% 65%;
    --chart-info-strong: 210 95% 65%;
```

In `tailwind.config.ts`, inside the `chart:` object (after line 77), add:

```ts
          "positive-text": "hsl(var(--chart-positive-text))",
          "negative-text": "hsl(var(--chart-negative-text))",
          "info-text": "hsl(var(--chart-info-text))",
          "muted-text": "hsl(var(--chart-muted-text))",
          "info-strong": "hsl(var(--chart-info-strong))",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/charts/__tests__/tokenContrast.test.ts`
Expected: PASS, 19 tests.

If any assertion fails, adjust that token's lightness percentage and re-run. Lower lightness raises contrast on light backgrounds; raise it on dark. The test is the arbiter, not the starting values.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: 1791 passed (1772 baseline + 19 new).

- [ ] **Step 6: Commit**

```bash
git add src/index.css tailwind.config.ts src/charts/__tests__/tokenContrast.test.ts
git commit -m "feat(a11y): add text-safe color tokens with contrast regression guard"
```

---

### Task 2: Swap failing call sites to the text-safe tokens

**Files:**
- Modify: every file matching the grep below

**Interfaces:**
- Consumes: Tailwind classes from Task 1
- Produces: nothing new; this is a mechanical swap

- [ ] **Step 1: Find every call site**

Run:

```bash
grep -rn "text-chart-positive\b\|text-chart-negative\b\|text-chart-info\b\|text-slate-500\|text-muted-foreground" src/ --include=*.tsx
```

- [ ] **Step 2: Swap text usages only**

For each hit, apply this rule:

- `text-chart-positive` → `text-chart-positive-text`
- `text-chart-negative` → `text-chart-negative-text`
- `text-chart-info` → `text-chart-info-text`
- `text-slate-500` → `text-chart-muted-text`

**Do not change** `bg-chart-positive`, `border-chart-positive`, `fill-`, `stroke-`, or any value passed into an ECharts option object. Those are marks and correctly use the 3:1 tokens.

For the two white-on-fill badges, change the fill to the strong variant:

- `bg-chart-info` used behind white or `text-chart-bg` text → `bg-chart-info-strong`

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: 1791 passed. No test asserts on class names, so this should be inert.

- [ ] **Step 4: Verify in the browser**

Start the dev server via the preview tool (never `npm run dev` in a shell), then run this in the page console. Transitions must be disabled first or every reading is stale:

```js
(() => {
  const s = document.createElement('style');
  s.textContent = '*,*::before,*::after{transition:none !important;animation:none !important}';
  document.head.appendChild(s);
  const lum = c => { const [r,g,b] = c.map(v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*r+0.7152*g+0.0722*b; };
  const parse = s => { const m = s && s.match(/-?[\d.]+/g); return m ? m.slice(0,3).map(Number) : null; };
  const alph = s => { const m = s && s.match(/-?[\d.]+/g); return m && m.length>3 ? Number(m[3]) : 1; };
  const blend = (f,a,b) => f.map((c,i) => c*a + b[i]*(1-a));
  const ratio = (a,b) => { const L1=lum(a), L2=lum(b); const hi=Math.max(L1,L2), lo=Math.min(L1,L2); return +((hi+0.05)/(lo+0.05)).toFixed(2); };
  const eff = el => { let n=el; while(n){ const cs=getComputedStyle(n); const p=parse(cs.backgroundColor); if(p && alph(cs.backgroundColor)>0.5) return p; n=n.parentElement; } return [255,255,255]; };
  const fails = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const txt = [...el.childNodes].filter(x => x.nodeType===3).map(x => x.textContent.trim()).join(' ').trim();
    if (txt.length < 3) return;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight) || 400;
    const need = (fs>=24 || (fs>=18.66 && fw>=700)) ? 3 : 4.5;
    let fg = parse(cs.color); if(!fg) return;
    const bg = eff(el), a = alph(cs.color);
    if (a < 1) fg = blend(fg, a, bg);
    const rr = ratio(fg, bg);
    if (rr < need) fails.push({ r: rr, px: fs, txt: txt.slice(0,40) });
  });
  return JSON.stringify({ theme: document.documentElement.className || 'light', fails: fails.length, worst: fails.sort((a,b)=>a.r-b.r).slice(0,10) }, null, 2);
})()
```

Expected: `fails: 0` in light theme. Repeat after toggling to dark, reloading first so no stale transition values are read.

- [ ] **Step 5: Commit**

```bash
git add src/components/charts src/pages/ChartsDemo.tsx
git commit -m "fix(a11y): use text-safe tokens for UI text, keep mark tokens for marks"
```

---

### Task 3: Add section state to the URL

**Files:**
- Modify: `src/charts/urlState.ts`
- Modify: `src/charts/__tests__/urlState.test.ts`

**Interfaces:**
- Produces: `UrlState.section?: SectionId`, and `SECTION_IDS` exported from `src/charts/urlState.ts` as `readonly ["evidence","storytell","reuse","ship"]`, plus `type SectionId = typeof SECTION_IDS[number]`. Task 6 and Task 9 both import these.

- [ ] **Step 1: Write the failing test**

Append to `src/charts/__tests__/urlState.test.ts`:

```ts
import { SECTION_IDS } from "@/charts/urlState";

describe("section deep-link", () => {
  it("round-trips a section", () => {
    const s = { ...BASE, section: "evidence" as const };
    expect(decodeUrlState("#" + encodeUrlState(s)).section).toBe("evidence");
  });

  it("omits the key when no section is set", () => {
    expect(encodeUrlState(BASE)).not.toContain("s=");
  });

  it("ignores an unknown section value", () => {
    expect(decodeUrlState("#k=line&n=2&t=light&v=normal&s=bogus").section).toBeUndefined();
  });

  it("decodes every real section id", () => {
    for (const id of SECTION_IDS) {
      expect(decodeUrlState(`#s=${id}`).section).toBe(id);
    }
  });
});
```

`BASE` already exists in that file. If it does not, define it as a full `UrlState`:
`const BASE: UrlState = { kind: "line", n: 2, theme: "light", vision: "normal", compare: false, kindB: "bar", nB: 2, themeB: "dark" };`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/charts/__tests__/urlState.test.ts`
Expected: FAIL, `SECTION_IDS` is not exported.

- [ ] **Step 3: Implement**

In `src/charts/urlState.ts`, add above `UrlState`:

```ts
/** The four scroll-anchored sections. Order is the reading order. */
export const SECTION_IDS = ["evidence", "storytell", "reuse", "ship"] as const;
export type SectionId = (typeof SECTION_IDS)[number];
```

Add to the `UrlState` interface:

```ts
  /** Deep-linked section. Absent means "top of page". */
  section?: SectionId;
```

In `encodeUrlState`, before `return p.toString()`:

```ts
  if (s.section) p.set("s", s.section);
```

In `decodeUrlState`, before `return out`:

```ts
  const sec = p.get("s");
  if (sec && (SECTION_IDS as readonly string[]).includes(sec)) out.section = sec as SectionId;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/charts/__tests__/urlState.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite and commit**

```bash
npx vitest run
git add src/charts/urlState.ts src/charts/__tests__/urlState.test.ts
git commit -m "feat(nav): deep-link sections via the s hash key"
```

---

### Task 4: PaletteVerdict

Merges `BuilderAuditStatus`, `AuditSummaryCard`, and the inline `AccessibilityHarness` into one component. This is the whole builder audience, always on screen.

**Files:**
- Create: `src/components/charts/PaletteVerdict.tsx`
- Read for reference: `src/components/charts/BuilderAuditStatus.tsx`, `src/components/charts/AuditSummaryCard.tsx`, `AccessibilityHarness` inside `src/pages/ChartsDemo.tsx`

**Interfaces:**
- Consumes: `AuditReport` from `src/charts/audit.ts:74` — fields are `perVision: VisionResult[]`, `worstContrastVsBg: number`, `bgPass: boolean`, `overall: "pass" | "warn" | "fail"`. `VisionResult` is `{ mode, minDeltaE, pass, threshold }`. **There is no `relaxations` field on `AuditReport`.** Relaxations live on `SolveResult.relaxations: string[]` (`src/charts/palette/categorical.ts:156`), reachable as `chartTheme.solve.relaxations` (`ChartTheme.solve`, `src/charts/echartsTheme.ts:72`). They must be passed in separately.
- Note: `minDeltaE` is `Infinity` for sequential and diverging ramps, where pairwise separation is meaningless by design (`auditPalette`'s `skipPairwiseDeltaE`). Never call `.toFixed()` on it unguarded — route through `deltaEWords`, which returns "not applicable".
- Produces:
  ```ts
  export function PaletteVerdict(props: {
    audit: AuditReport;
    relaxations: string[];   // chartTheme.solve.relaxations
    label?: string;          // "A" / "B" in compare mode; omitted when single
    dense?: boolean;         // compare mode renders a slim row
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/charts/__tests__/PaletteVerdict.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaletteVerdict } from "../PaletteVerdict";
import { getChartTheme } from "@/charts/echartsTheme";
import { auditPalette } from "@/charts/audit";

function fixture() {
  const theme = getChartTheme("light", "comparative", 4);
  const colors = theme.solve.palette.slice(0, 4);
  const audit = auditPalette(colors, theme.tokens.bg);
  return { audit, relaxations: theme.solve.relaxations };
}

describe("PaletteVerdict", () => {
  it("states the verdict exactly once", () => {
    const f = fixture();
    render(<PaletteVerdict {...f} />);
    // The old page printed this same number in four panels. One now.
    expect(screen.getAllByTestId("verdict-min-delta-e")).toHaveLength(1);
  });

  it("shows contrast, min deltaE, and relaxation count when collapsed", () => {
    render(<PaletteVerdict {...fixture()} />);
    expect(screen.getByTestId("verdict-contrast")).toBeInTheDocument();
    expect(screen.getByTestId("verdict-min-delta-e")).toBeInTheDocument();
    expect(screen.getByTestId("verdict-relaxations")).toBeInTheDocument();
  });

  it("hides the per-mode breakdown until expanded", () => {
    render(<PaletteVerdict {...fixture()} />);
    expect(screen.queryByText(/deutan/i)).not.toBeInTheDocument();
  });

  it("lists all four vision modes when expanded", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<PaletteVerdict {...fixture()} />);
    await userEvent.click(screen.getByRole("button", { name: /detail/i }));
    for (const mode of [/deutan/i, /protan/i, /tritan/i, /mono|achromat/i]) {
      expect(screen.getByText(mode)).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/charts/__tests__/PaletteVerdict.test.tsx`
Expected: FAIL, cannot resolve `../PaletteVerdict`.

- [ ] **Step 3: Implement**

Create `src/components/charts/PaletteVerdict.tsx`. Lift the number formatting from `AuditSummaryCard.tsx` verbatim, including its `deltaEWords` helper, which exists because the raw pass floor reads as nonsense on its own. Lift the per-mode rows from `BuilderAuditStatus.tsx`.

```tsx
/**
 * PaletteVerdict — the single live answer to "is this palette safe?".
 *
 * Replaces BuilderAuditStatus + AuditSummaryCard + the inline
 * AccessibilityHarness, which between them printed the same three numbers in
 * three places across five screens. This component is pinned beside the chart
 * and never scrolls away, so Verify stops being a destination.
 *
 * Collapsed: status chip, WCAG ratio vs background, min deltaE (normal and
 * worst CVD), relaxation count.
 * Expanded: per-mode breakdown for deutan / protan / tritan / mono, plus the
 * warnings list.
 */
import { useState } from "react";
import type { AuditReport } from "@/charts/audit";
// Term is deliberately NOT imported here: it does not exist until Task 5.
// Task 5 Step 7 comes back and wraps the three labels below.

/** Human reading of a min pairwise deltaE. Moved verbatim from AuditSummaryCard. */
function deltaEWords(v: number): string {
  if (!Number.isFinite(v)) return "not applicable";
  if (v >= 10) return "clearly distinct";
  if (v >= 2) return "distinguishable";
  return "patterns carry identity";
}

export function PaletteVerdict({
  audit,
  relaxations,
  label,
  dense = false,
}: {
  audit: AuditReport;
  relaxations: string[];
  label?: string;
  dense?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const normal = audit.perVision.find((v) => v.mode === "normal");
  const worstCvd = audit.perVision
    .filter((v) => v.mode !== "normal")
    .reduce((a, b) => (a.minDeltaE <= b.minDeltaE ? a : b));

  const tone =
    audit.overall === "pass"
      ? "text-chart-positive-text"
      : audit.overall === "warn"
        ? "text-chart-warn"
        : "text-chart-negative-text";

  return (
    <section
      className="rounded-md border border-chart-grid bg-chart-surface px-3 py-2"
      aria-label={label ? `Palette verdict ${label}` : "Palette verdict"}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {label && <span className="font-medium text-chart-muted-text">{label}</span>}
        <span className={`font-semibold uppercase tracking-wide ${tone}`}>
          {audit.overall}
        </span>
        <span data-testid="verdict-contrast" className="tabular-nums text-chart-muted-text">
          WCAG {audit.worstContrastVsBg.toFixed(2)}:1
        </span>
        <span data-testid="verdict-min-delta-e" className="tabular-nums text-chart-muted-text">
          {/* minDeltaE is Infinity for ramps by design, so never .toFixed() it raw. */}
          ΔE {deltaEWords(normal?.minDeltaE ?? NaN)}
          {Number.isFinite(normal?.minDeltaE) && ` ${normal!.minDeltaE.toFixed(1)}`}
          {Number.isFinite(worstCvd.minDeltaE) && ` · worst CVD ${worstCvd.minDeltaE.toFixed(1)}`}
        </span>
        <span data-testid="verdict-relaxations" className="tabular-nums text-chart-muted-text">
          relaxations {relaxations.length}
        </span>
        {!dense && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="ml-auto min-h-6 rounded border border-chart-grid px-2 text-chart-muted-text hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
          >
            {open ? "Hide detail" : "Detail"}
          </button>
        )}
      </div>

      {open && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-chart-grid pt-2 text-[11px] sm:grid-cols-4">
          {audit.perVision.map((v) => (
            <div key={v.mode}>
              <dt className="uppercase tracking-wide text-chart-muted-text">{v.mode}</dt>
              <dd className="tabular-nums text-foreground">
                {Number.isFinite(v.minDeltaE) ? v.minDeltaE.toFixed(1) : "n/a"}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
```

All field names above were verified against `src/charts/audit.ts:67-80` and `src/charts/palette/categorical.ts:150-156` while writing this plan. Do not "fix" `perVision` to `vision` or reach for `audit.relaxations`; neither exists.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/charts/__tests__/PaletteVerdict.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/charts/PaletteVerdict.tsx src/components/charts/__tests__/PaletteVerdict.test.tsx
git commit -m "feat(audit): single PaletteVerdict replacing three duplicate panels"
```

---

### Task 5: Term and ReferenceDrawer

The glossary stops being a place. Terms define themselves where they appear.

**Files:**
- Create: `src/charts/glossary.ts`, `src/components/charts/Term.tsx`, `src/components/charts/ReferenceDrawer.tsx`
- Delete: `src/components/charts/Glossary.tsx`

**Interfaces:**
- Produces:
  ```ts
  // src/charts/glossary.ts
  export interface GlossaryEntry { term: string; short: string; detail: string; source?: string }
  export const GLOSSARY: GlossaryEntry[]
  export function lookup(term: string): GlossaryEntry | undefined

  // Term.tsx
  export function Term(props: { id: string; children: React.ReactNode }): JSX.Element

  // ReferenceDrawer.tsx
  export function ReferenceDrawer(props: { open: boolean; onClose: () => void; focusTerm?: string }): JSX.Element | null
  ```

- [ ] **Step 1: Write the failing test**

Create `src/charts/__tests__/glossary.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { GLOSSARY, lookup } from "@/charts/glossary";

describe("glossary", () => {
  it("keeps all twelve entries from the old panel", () => {
    expect(GLOSSARY).toHaveLength(12);
  });

  it("looks up by exact term", () => {
    expect(lookup("OKLab")?.short).toMatch(/color space/i);
  });

  it("returns undefined for an unknown term", () => {
    expect(lookup("nope")).toBeUndefined();
  });

  it("gives every entry a one-line short and a detail", () => {
    for (const e of GLOSSARY) {
      expect(e.short.length).toBeGreaterThan(0);
      expect(e.detail.length).toBeGreaterThan(e.short.length);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/charts/__tests__/glossary.test.ts`
Expected: FAIL, cannot resolve `@/charts/glossary`.

- [ ] **Step 3: Move the entries**

Create `src/charts/glossary.ts`. Copy the `Entry` interface and the entire `ENTRIES` array from `src/components/charts/Glossary.tsx:10-103` **verbatim** — the definitions are accurate and hard-won, do not rewrite them. Rename the export:

```ts
/**
 * Plain-language definitions for every technical term the tool surfaces.
 *
 * Single source of truth for both the ReferenceDrawer list and the inline
 * <Term> popovers, so the two cannot drift apart.
 */
export interface GlossaryEntry {
  term: string;
  short: string;
  detail: string;
  /** Where this concept is implemented or enforced. */
  source?: string;
}

export const GLOSSARY: GlossaryEntry[] = [ /* ...the 12 entries, verbatim... */ ];

export function lookup(term: string): GlossaryEntry | undefined {
  return GLOSSARY.find((e) => e.term === term);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/charts/__tests__/glossary.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write Term**

Create `src/components/charts/Term.tsx`:

```tsx
/**
 * Term — an inline technical term that defines itself in place.
 *
 * The glossary used to be a collapsed panel at the bottom of an 8-screen
 * page. "ΔE" appears 61 times on screen and was defined in exactly one place
 * nobody scrolled to. Wrap the *first* occurrence per panel, not all of them,
 * or the page turns into a field of dotted underlines.
 */
import { useState } from "react";
import { lookup } from "@/charts/glossary";

export function Term({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const entry = lookup(id);
  if (!entry) return <>{children}</>;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label={`${entry.term}: ${entry.short}`}
        className="min-h-6 cursor-help underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1 block w-64 rounded-md border border-chart-grid bg-chart-bg p-2 text-[11px] font-normal normal-case tracking-normal text-foreground shadow-lg"
        >
          <span className="block font-medium">{entry.term}</span>
          <span className="mt-0.5 block text-chart-muted-text">{entry.short}</span>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent("open-reference", { detail: entry.term }));
            }}
            className="mt-1 block text-chart-info-text underline"
          >
            Full definition
          </button>
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 6: Write ReferenceDrawer**

Create `src/components/charts/ReferenceDrawer.tsx`. Radix `Dialog` is already a
dependency (`@radix-ui/react-dialog`) and gives focus trapping, Esc, and focus
restore for free, so do not hand-roll them.

```tsx
/**
 * ReferenceDrawer — the glossary and decision rationale, reachable from every
 * section instead of parked at the bottom of an 8-screen page.
 *
 * Radix Dialog supplies the focus trap, Esc handling, and focus restore.
 */
import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { GLOSSARY } from "@/charts/glossary";

export function ReferenceDrawer({
  open,
  onClose,
  focusTerm,
}: {
  open: boolean;
  onClose: () => void;
  focusTerm?: string;
}) {
  const listRef = useRef<HTMLDListElement>(null);

  useEffect(() => {
    if (!open || !focusTerm) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-term="${CSS.escape(focusTerm)}"]`
    );
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, [open, focusTerm]);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          aria-label="Reference"
          className="fixed right-0 top-0 z-50 h-dvh w-full max-w-xl overflow-y-auto border-l border-chart-grid bg-chart-bg p-4 sm:w-[36rem]"
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-sm font-medium uppercase tracking-wide text-chart-muted-text">
              Reference
            </Dialog.Title>
            <Dialog.Close className="tap-target rounded border border-chart-grid px-2 text-xs text-chart-muted-text hover:text-foreground">
              Close
            </Dialog.Close>
          </div>
          <dl ref={listRef} className="mt-4 space-y-4">
            {GLOSSARY.map((e) => (
              <div key={e.term} data-term={e.term} className="space-y-1">
                <dt className="text-sm font-medium text-foreground">{e.term}</dt>
                <dd className="text-xs text-chart-muted-text">
                  <span className="text-foreground/80">{e.short}</span> {e.detail}
                  {e.source && (
                    <span className="mt-0.5 block font-mono text-[10px] text-chart-muted-text">
                      {e.source}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

The `?` shortcut and the `open-reference` event listener are owned by
`ChartsDemo.tsx` (Task 9 Step 6), not by this component, so the drawer stays a
pure presentation component:

```tsx
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    // Do not steal "?" from a field the user is typing in.
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === "?") { setFocusTerm(undefined); setRefOpen(true); }
  }
  function onOpenRef(e: Event) {
    setFocusTerm((e as CustomEvent<string>).detail);
    setRefOpen(true);
  }
  window.addEventListener("keydown", onKey);
  window.addEventListener("open-reference", onOpenRef);
  return () => {
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("open-reference", onOpenRef);
  };
}, []);
```

`ExplainPanel` (currently defined inline in `ChartsDemo.tsx`) moves into this
drawer below the `<dl>`. Move it verbatim; it is a rendering of
`src/charts/bestPractices.ts`, not new prose.

- [ ] **Step 7: Wrap the verdict's three labels**

Task 4 shipped `PaletteVerdict` with plain-text labels because `Term` did not exist
yet. Now wrap them. The `id` must match the entry's `term` field exactly, or `lookup`
returns undefined and `Term` silently renders plain children.

In `src/components/charts/PaletteVerdict.tsx` add `import { Term } from "./Term";`
and change the three labels:

- `WCAG {audit.worstContrastVsBg...}` → `<Term id="WCAG 2.2 SC 1.4.11">WCAG</Term> {audit.worstContrastVsBg...}`
- `ΔE {deltaEWords(...)}` → `<Term id="ΔE (Delta-E)">ΔE</Term> {deltaEWords(...)}`
- `relaxations {relaxations.length}` → `<Term id="Relaxation">relaxations</Term> {relaxations.length}`

Re-run `npx vitest run src/components/charts/__tests__/PaletteVerdict.test.tsx`.
The `data-testid` values are unchanged, so all four tests must still pass.

- [ ] **Step 8: Delete the old panel and run the suite**

```bash
git rm src/components/charts/Glossary.tsx
npx vitest run
```

Expected: green. `ChartsDemo.tsx` still imports `Glossary` at line 30 and will fail to compile — remove that import and its `<Glossary />` usage now; the drawer is wired in Task 9.

- [ ] **Step 9: Commit**

```bash
git add src/charts/glossary.ts src/charts/__tests__/glossary.test.ts src/components/charts/Term.tsx src/components/charts/ReferenceDrawer.tsx src/components/charts/PaletteVerdict.tsx src/pages/ChartsDemo.tsx
git commit -m "feat(reference): glossary becomes a drawer plus inline term popovers"
```

---

### Task 6: SectionNav

Replaces `FlowStepper`. Four pills instead of seven, correct scrollspy, real deep links.

**Files:**
- Create: `src/components/charts/SectionNav.tsx`
- Create: `src/charts/__tests__/sections.test.ts`
- Delete: `src/components/charts/FlowStepper.tsx`

**Interfaces:**
- Consumes: `SECTION_IDS`, `SectionId` from `src/charts/urlState.ts` (Task 3)
- Produces:
  ```ts
  export const SECTION_LABELS: Record<SectionId, string>
  export function SectionNav(props: { onNavigate: (id: SectionId) => void }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `src/charts/__tests__/sections.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SECTION_IDS } from "@/charts/urlState";
import { SECTION_LABELS } from "@/components/charts/SectionNav";

describe("section constants", () => {
  it("labels every section id", () => {
    for (const id of SECTION_IDS) {
      expect(SECTION_LABELS[id]).toBeTruthy();
    }
  });

  it("has no labels for ids that do not exist", () => {
    expect(Object.keys(SECTION_LABELS).sort()).toEqual([...SECTION_IDS].sort());
  });

  it("uses no em dashes in labels", () => {
    for (const label of Object.values(SECTION_LABELS)) {
      expect(label).not.toContain("—");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/charts/__tests__/sections.test.ts`
Expected: FAIL, cannot resolve `SectionNav`.

- [ ] **Step 3: Implement**

Create `src/components/charts/SectionNav.tsx`:

```tsx
/**
 * SectionNav — four scroll-anchored sections in one sticky bar.
 *
 * Replaces FlowStepper, which showed seven pills all pointing into a single
 * <section id="flow-build">, left two of its targets with no heading at all,
 * and could not reach the two screens of audit content that sat outside its
 * map entirely.
 *
 * Deliberately NOT a tablist: sections are scroll-anchored, so tab semantics
 * would tell a screen reader that content swaps when it does not. It is a nav
 * with aria-current.
 */
import { useEffect, useState } from "react";
import { SECTION_IDS, type SectionId } from "@/charts/urlState";

export const SECTION_LABELS: Record<SectionId, string> = {
  evidence: "Evidence",
  storytell: "Storytell",
  reuse: "Reuse",
  ship: "Ship",
};

export function SectionNav({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const [active, setActive] = useState<SectionId>(SECTION_IDS[0]);

  useEffect(() => {
    // Scrollspy: the LAST section whose top has crossed the threshold wins.
    // FlowStepper picked the highest intersectionRatio, so a tall section
    // stayed lit while a short one below it was being read. Evidence is by
    // far the tallest section, so that bug would be constant here.
    function onScroll() {
      const line = window.innerHeight * 0.3;
      let current: SectionId = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(`section-${id}`);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <nav aria-label="Sections" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {SECTION_IDS.map((id) => {
        const isActive = active === id;
        return (
          <a
            key={id}
            href={`#section-${id}`}
            aria-current={isActive ? "true" : undefined}
            onClick={(e) => {
              // ShareLink owns location.hash for palette state, so a real
              // anchor jump would wipe the user's configuration.
              e.preventDefault();
              onNavigate(id);
            }}
            className={[
              "min-h-11 shrink-0 snap-start rounded-full border px-3 py-1 text-xs leading-9 transition-colors sm:min-h-0 sm:leading-normal",
              isActive
                ? "border-chart-info-strong bg-chart-info-strong font-medium text-chart-bg"
                : "border-chart-grid bg-chart-surface text-chart-muted-text hover:text-foreground",
            ].join(" ")}
          >
            {SECTION_LABELS[id]}
          </a>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run tests, delete the old stepper**

```bash
npx vitest run src/charts/__tests__/sections.test.ts
git rm src/components/charts/FlowStepper.tsx
```

Expected: PASS, 3 tests. `ChartsDemo.tsx` imports `FlowStepper` and will not compile; it is replaced in Task 9.

- [ ] **Step 5: Commit**

```bash
git add src/components/charts/SectionNav.tsx src/charts/__tests__/sections.test.ts
git commit -m "feat(nav): four-section nav with corrected scrollspy"
```

---

### Task 7: SystemAudit

Merges `AutoAuditSummary` (12 permutations) and `FullPermutationAudit` (374). The 12 are a subset of the 374, so the first becomes a filtered default rather than a separate stacked panel.

**Files:**
- Create: `src/components/charts/SystemAudit.tsx`
- Delete: `src/components/charts/AutoAuditSummary.tsx`
- Read for reference: `src/components/charts/FullPermutationAudit.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type AuditScope = "kind" | "all";
  export function SystemAudit(props: {
    hasManualOverrides: boolean;
    kind: ChartKind;
    theme: Theme;
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/charts/__tests__/SystemAudit.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SystemAudit } from "../SystemAudit";

describe("SystemAudit", () => {
  const props = { hasManualOverrides: false, kind: "line" as const, theme: "light" as const };

  it("defaults to the current chart type", () => {
    render(<SystemAudit {...props} />);
    expect(screen.getByRole("radio", { name: /this chart type/i })).toBeChecked();
  });

  it("offers both scopes", () => {
    render(<SystemAudit {...props} />);
    expect(screen.getByRole("radio", { name: /everything/i })).toBeInTheDocument();
  });

  it("switches scope on click", async () => {
    render(<SystemAudit {...props} />);
    await userEvent.click(screen.getByRole("radio", { name: /everything/i }));
    expect(screen.getByRole("radio", { name: /everything/i })).toBeChecked();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/charts/__tests__/SystemAudit.test.tsx`
Expected: FAIL, cannot resolve `../SystemAudit`.

- [ ] **Step 3: Implement**

Copy `FullPermutationAudit.tsx` to `SystemAudit.tsx` as the base. Keep the existing
"Run audit" button, the `Details` disclosure, and the non-optimal explanation prose
exactly as they are. Add the scope control and filter:

```tsx
export type AuditScope = "kind" | "all";

const [scope, setScope] = useState<AuditScope>("kind");

// The old AutoAuditSummary swept the 12 permutations reachable for the current
// (kind, theme) and rendered as its own panel directly above this one, which
// swept all 374. The 12 are a subset of the 374, so it is now a filter.
const rows = useMemo(
  () => (scope === "kind" ? allRows.filter((r) => r.kind === kind && r.theme === theme) : allRows),
  [allRows, scope, kind, theme]
);
```

```tsx
<div role="radiogroup" aria-label="Audit scope" className="flex gap-1">
  {([
    ["kind", "This chart type"],
    ["all", "Everything"],
  ] as const).map(([value, label]) => (
    <button
      key={value}
      type="button"
      role="radio"
      aria-checked={scope === value}
      onClick={() => setScope(value)}
      className={[
        "tap-target rounded border px-2 py-1 text-xs transition-colors",
        scope === value
          ? "border-chart-info-strong bg-chart-info-strong text-chart-bg"
          : "border-chart-grid bg-chart-surface text-chart-muted-text hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </button>
  ))}
</div>
```

**Never let a filtered pass read as a full pass.** The summary line must name the
subset, not print a bare count:

```tsx
<p className="text-[11px] text-chart-muted-text">
  {scope === "kind"
    ? `${rows.length} permutations swept for ${CHART_KIND_LABEL[kind]} · ${theme} theme. ${allRows.length - rows.length} other combinations not covered by this scope.`
    : `${rows.length} permutations swept (theme × kind × N).`}
</p>
```

- [ ] **Step 4: Run tests and delete the old panel**

```bash
npx vitest run src/components/charts/__tests__/SystemAudit.test.tsx
git rm src/components/charts/AutoAuditSummary.tsx
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/components/charts/SystemAudit.tsx src/components/charts/__tests__/SystemAudit.test.tsx src/pages/ChartsDemo.tsx
git commit -m "feat(audit): merge the two permutation sweeps behind a scope toggle"
```

---

### Task 8: Section wrappers

**Files:**
- Create: `src/components/charts/sections/Evidence.tsx`, `Storytell.tsx`, `Reuse.tsx`, `Ship.tsx`

**Interfaces:**
- Consumes: `SECTION_LABELS` from `SectionNav.tsx`
- Produces: four components, each rendering `<section id="section-{id}">` with a real `<h2>`

- [ ] **Step 1: Write the failing test**

Create `src/components/charts/__tests__/sections.render.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Evidence } from "../sections/Evidence";

describe("section wrappers", () => {
  it("gives Evidence an anchor id the nav can find", () => {
    const { container } = render(<Evidence>{null}</Evidence>);
    expect(container.querySelector("#section-evidence")).toBeInTheDocument();
  });

  it("gives Evidence a real heading", () => {
    render(<Evidence>{null}</Evidence>);
    // flow-verify and flow-reuse had no heading at all. Every section gets one.
    expect(screen.getByRole("heading", { level: 2, name: /evidence/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/charts/__tests__/sections.render.test.tsx`
Expected: FAIL, cannot resolve `../sections/Evidence`.

- [ ] **Step 3: Implement**

Create each wrapper on this shape (repeated per section; do not abstract into one generic component, the sections will diverge):

```tsx
/**
 * Evidence — proof for a reviewer, as opposed to the pinned PaletteVerdict
 * which serves the person actively building. Holds VisionMatrix,
 * SemanticRoleAudit, SystemAudit, and BenchmarkPanel.
 *
 * scroll-mt-14 clears the 48px sticky bar so anchored jumps do not land
 * under it.
 */
export function Evidence({ children }: { children: React.ReactNode }) {
  return (
    <section id="section-evidence" className="scroll-mt-14 space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-chart-muted-text">
        Evidence
      </h2>
      {children}
    </section>
  );
}
```

`Storytell`, `Reuse`, and `Ship` are identical with their own id and heading.

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run
git add src/components/charts/sections src/components/charts/__tests__/sections.render.test.tsx
git commit -m "feat(nav): section wrappers with real headings and anchors"
```

---

### Task 9: Assemble the page

The one big edit. `ChartsDemo.tsx` is 3,080 lines; this restructures its render tree.

**Files:**
- Modify: `src/pages/ChartsDemo.tsx` (render block starts line 1284)

**Interfaces:**
- Consumes: everything from Tasks 3 through 8

- [ ] **Step 1: Replace the header and nav**

Replace the `<header>` block (lines 1288-1322) plus `<FlowStepper />` (line 1324) with a single 48px sticky bar holding the mark, `<SectionNav />`, a Glossary button, and the share/export actions. The page title block moves below the bar and scrolls away. No "Home" breadcrumb.

`onNavigate` does three things: writes `s=<id>` into the hash via the existing `urlState` setter, scrolls the section into view, and respects reduced motion:

```tsx
function goToSection(id: SectionId) {
  setSection(id); // flows into urlState -> hash
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(`section-${id}`)?.scrollIntoView({
    behavior: reduce ? "auto" : "smooth",
    block: "start",
  });
}
```

Scrollspy must not write the hash. Only `goToSection` does, or scrolling shreds the back button.

- [ ] **Step 2: Pin the chart and verdict**

The sticky column (currently line 1349, `lg:sticky lg:top-[52px]`) becomes chart + vision toggle + `PaletteVerdict`. Keep `data-tour="vision-preview"` on the same wrapper div.

The chart height must flex or the verdict falls off a 720px screen. Budget after the 48px bar and padding is 656px; today's fixed 560px chart plus toggle plus verdict is about 740px.

```tsx
<div className="lg:sticky lg:top-14 space-y-3">
  <ChartCard title={...}>
    <div style={{ filter: VISION_FILTER[vision], height: "clamp(300px, calc(100dvh - 260px), 560px)" }}>
      <EChart option={option} height="100%" />
    </div>
  </ChartCard>
  <div data-tour="vision-preview">
    <VisionPreviewToggle value={vision} onChange={setVision} />
  </div>
  <PaletteVerdict audit={audit} relaxations={chartTheme.solve.relaxations} />
</div>
```

`EChart` currently takes `height={560}` as a number. Check its prop type and widen it to `number | string` if needed.

- [ ] **Step 3: Move panels into their sections**

| Section | Contents |
| --- | --- |
| Evidence | `VisionMatrix`, `SemanticRoleAudit`, `SystemAudit`, `BenchmarkPanel` |
| Storytell | `InsightCallouts`, `EmphasisPreview`, `DensityPreview` |
| Reuse | `PalettePresets`, `WorkflowPresets`, `EntityPins` |
| Ship | `CodeSnippet`, `ExportPalette` (keep `data-tour="export-palette"`), `ShareLink` |

`BenchmarkPanel` moves out of Storytell into Evidence: comparing against known palettes is proof, not narrative.

Delete the now-orphaned renders of `AutoAuditSummary`, `BuilderAuditStatus`, and `AuditSummaryCard` (lines ~1671-1718 pre-edit).

- [ ] **Step 4: Delete the duplicated rationale prose**

The paragraph beginning "Lines must be distinguishable in both color and dash" is a
single string, `BestPractice.rationale` (`src/charts/bestPractices.ts:51`), rendered
through **three** paths. Measured on the live page: it appears three times verbatim,
at character offsets 933, 2175, and 9647.

| Render site | Disposition |
| --- | --- |
| Builder "why this palette" box, next to the controls | **Keep.** The field's own docstring says it is "shown next to the chart" |
| `ExplainPanel` | Already gone: it moved into `ReferenceDrawer` in Task 5, so it leaves the page flow |
| Warning entries, `ChartsDemo.tsx:607` and `:612` (`detail: r.rationale`) | **Change.** A warning should say what is wrong, not restate the general rule |

For the two warning sites, replace `detail: r.rationale` with a specific message
naming the actual condition, for example:

```ts
ws.push({
  severity: "warn",
  title: w,
  detail: `${CHART_KIND_LABEL[kind]} recommends N ≤ ${rule.recommendedN}; you are rendering ${n}.`,
});
```

Verify on the live page after the edit:

```js
(() => {
  const t = document.body.innerText, probe = 'Lines must be distinguishable';
  let i = -1, n = 0;
  while ((i = t.indexOf(probe, i + 1)) > -1) n++;
  return n;
})()
```

Expected: `1`.

- [ ] **Step 5: Compare mode**

When `compare` is true, chart pinning turns off and `PaletteVerdict` renders twice with `dense` and `label="A"` / `label="B"` in a slim sticky bar under the app bar. The charts scroll; the verdicts do not.

- [ ] **Step 6: Wire the drawer**

Render `<ReferenceDrawer open={refOpen} onClose={() => setRefOpen(false)} />` at page level. Wire the header Glossary button and the `?` key.

- [ ] **Step 7: Run the suite**

Run: `npx vitest run`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add src/pages/ChartsDemo.tsx src/components/charts/EChart.tsx
git commit -m "feat(nav): pinned verdict, four sections, one sticky bar"
```

---

### Task 10: Target sizes and reduced motion

**Files:**
- Modify: `src/index.css`, `src/components/charts/CoachTour.tsx:90`, plus the components owning the 11 undersized controls

**Interfaces:** none

- [ ] **Step 1: Find the undersized controls**

With the dev server running, in the page console:

```js
(() => {
  const small = [...document.querySelectorAll('button,a,input,select,[role=radio],[role=checkbox]')]
    .map(e => ({ e, r: e.getBoundingClientRect() }))
    .filter(x => x.r.width > 0 && (x.r.height < 24 || x.r.width < 24))
    .map(x => ({ tag: x.e.tagName, h: Math.round(x.r.height), w: Math.round(x.r.width),
                 label: (x.e.getAttribute('aria-label') || x.e.title || x.e.textContent || '').trim().slice(0,40) }));
  return JSON.stringify({ count: small.length, small }, null, 2);
})()
```

Baseline is 11: two checkboxes at 13x13, six preset buttons 16px tall, two selects at 22px, one button at 22px.

- [ ] **Step 2: Raise them**

24x24 minimum everywhere (SC 2.5.8 AA), 44x44 under coarse pointers. Add to `src/index.css`:

```css
@layer components {
  /* WCAG 2.2 SC 2.5.8: 24x24 minimum. Coarse pointers get the AAA 44px. */
  .tap-target {
    min-height: 1.5rem;
    min-width: 1.5rem;
  }
  @media (pointer: coarse) {
    .tap-target {
      min-height: 2.75rem;
      min-width: 2.75rem;
    }
  }
}
```

Apply `tap-target` to each of the 11. For the 13x13 checkboxes, keep the visual box small and grow the hit area with padding on the label rather than scaling the control.

- [ ] **Step 3: Reduced motion in the tour**

`CoachTour.tsx:90` calls `scrollIntoView({ behavior: "smooth" })` unconditionally:

```tsx
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
```

- [ ] **Step 4: Re-run the probe**

Expected: `count: 0`.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/charts src/pages/ChartsDemo.tsx
git commit -m "fix(a11y): 24px minimum targets, 44px on touch, reduced-motion tour"
```

---

### Task 11: Browser verification

Nothing here is done until these pass. "It should work" is not verification.

**Files:** none

- [ ] **Step 1: Contrast, both themes**

Run the Task 2 Step 4 probe at 1280x800 in light theme. Reload, switch to dark, reload again, re-run. Reloading matters: `transition-colors` plus CSS-variable theming leaves computed colors stale after a theme flip, and a sweep without the transition-killing style reports phantom failures.

Expected: `fails: 0` in both.

- [ ] **Step 2: Target sizes**

Run the Task 10 Step 1 probe. Expected: `count: 0`.

- [ ] **Step 3: The verdict never leaves the screen**

At 1280x720, scroll to the bottom of each of the four sections and confirm `PaletteVerdict` is still visible:

```js
(() => {
  const v = document.querySelector('[aria-label^="Palette verdict"]');
  const r = v.getBoundingClientRect();
  return JSON.stringify({ scrollY: window.scrollY, top: Math.round(r.top), bottom: Math.round(r.bottom), visible: r.top >= 0 && r.bottom <= innerHeight });
})()
```

Expected: `visible: true` at every position. Repeat with compare mode on.

- [ ] **Step 4: Page height**

```js
(() => { const h = document.documentElement.scrollHeight; return JSON.stringify({ px: h, screens: +(h / innerHeight).toFixed(1) }); })()
```

Baseline was 6,454px / 8.1 screens at 1280x800. Expected: under 6 screens.

- [ ] **Step 5: Coach tour**

Click "Take the tour". Walk all four steps. The highlight must track each anchor, including `vision-preview` now that it sits in a sticky column. No `STEPS` edit should have been needed.

- [ ] **Step 6: Deep links**

Load `#k=line&n=6&t=dark&v=deutan&s=evidence` in a fresh tab. Expected: dark theme, N=6, deutan preview, scrolled to Evidence. Then scroll manually and confirm the hash does **not** change, and the back button still works.

- [ ] **Step 7: Narrow viewport**

The preview pane would not go below 754px during design, so this is unverified and is a blocker, not a footnote. Verify at 754px that the nav stays one row and does not wrap to the 103px block the old seven-pill stepper produced. If a true phone width still cannot be reached in the harness, say so explicitly in the PR rather than claiming it passes.

- [ ] **Step 8: Full suite and push**

```bash
npx vitest run
git push -u origin feat/nav-rebuild-and-contrast
```

Expected: all green, baseline 1,772 plus the new tests.

---

## Self-Review Notes

Spec sections mapped to tasks: two-audience split → 4, 7; component merges → 4, 7; four sections → 6, 8; layout and clamp → 9; scrollspy fix → 6; URL state → 3; compare mode → 9; responsive → 6, 10; drawer and terms → 5; accessibility → 6, 10; token fix → 1, 2; CoachTour → 9, 10; file-level plan → all.

Known risk carried forward from the spec: the chart shrinks to 460px at a 720px viewport to keep the verdict pinned. Accepted, reversible by changing one `clamp`.

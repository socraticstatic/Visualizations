# Chart Color System Figma Plugin, Plan 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Figma plugin that generates audited palettes into Figma variables, audits colors already in a file, and renders CVD simulations onto the canvas, using only the already-MIT engine and changing no licenses.

**Architecture:** A `figma/` directory beside `mcp/`, built as two bundles: a sandbox script holding the `figma` API and an iframe UI holding all color math. The sandbox only serializes what it sees and applies specs it is handed; every decision is made by a pure function in `figma/src/shared/` that never imports `figma` and is unit-tested without it. Engine code is imported in-repo through an `@engine` alias, restricted to the MIT paths.

**Tech Stack:** TypeScript, Vite (two builds), React 18 for the iframe UI, Vitest, `@figma/plugin-typings`, `culori` (transitively, via the engine).

**Spec:** `docs/superpowers/specs/2026-09-14-figma-plugin-design.md`

## Global Constraints

- Manifest MUST declare `"networkAccess": { "allowedDomains": ["none"] }`. The plugin makes no network requests, ever.
- Manifest MUST declare `"documentAccess": "dynamic-page"`. Consequence: variable **getters** are async (`getLocalVariableCollectionsAsync`, `getVariableByIdAsync`, `getVariableCollectionByIdAsync`). `setValueForMode(modeId, newValue)` is **synchronous** and there is no `setValueForModeAsync`.
- Plan 1 changes NO licenses. Only these already-MIT engine modules may be imported: `palette/**`, `constraints.ts`, `encoding.ts`, `audit.ts`, `version.ts`.
- Plan 1 MUST NOT import `bestPractices.ts`, `chartKinds.ts`, `builtinBounds.ts`, `fixtures.ts`, or `echartsTheme.ts`. Those are proprietary and belong to Plan 2. `safeMaxN` is therefore unavailable.
- **Posture is a direct control in Plan 1.** The spec says posture derives from chart kind, but chart kinds are Plan 2. Until then Generate exposes the three MIT-defined postures from `POSTURE` in `constraints.ts` and caps N at `min(MAX_SLOTS, POSTURE[posture].maxCategorical)`, with the live `auditPalette` verdict shown alongside. When Mockup lands, chart kind takes over and this control becomes derived.
- Every module under `figma/src/shared/` is pure: it MUST NOT reference the `figma` global or the DOM. This is what makes it testable.
- **Refuse, do not silently fix.** Any condition the plugin cannot handle defensibly is reported with its reason and the action is blocked. Never substitute an assumed value.
- `ColorRecord.rgb` channels are 0..1, the same space as Figma's `RGB`. Verified round-trip: `fromCss(\`rgb(${r * 100}% ${g * 100}% ${b * 100}%)\`)` preserves channels within 1e-6.
- User-facing copy uses no em dashes. Hyphens or rephrase.
- Node 24, ESM throughout, `"type": "module"`.

---

### Task 1: Cut the proprietary coupling in echartsTheme (P0)

`echartsTheme.ts` imports `getEditedAnchorIndexes` from `manualOverrides.ts`, which imports `Theme` back from `echartsTheme.ts`. One circular pair, one call site. Thread it as a parameter so the five files Plan 2 will relicense have no proprietary dependency, and so the library loses a circular import. Nothing in Plan 1 depends on this; it is sequenced first because it is small and independently valuable.

**Files:**
- Modify: `src/charts/echartsTheme.ts:13` (remove import), `src/charts/echartsTheme.ts:130-138` (signature and call site)
- Modify: `src/charts/builtinBounds.ts:48` (thread the parameter through `safeMaxN`)
- Modify: `src/pages/ChartsDemo.tsx` (callers supply the value)
- Test: `src/charts/__tests__/anchorLocks.test.ts` (existing, must still pass), plus a new case in `src/charts/__tests__/tokenContrast.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `getChartTheme(theme: Theme, posture: Posture, n: number, editedAnchorIndexes?: number[]): ChartTheme` and `safeMaxN(theme: Theme, posture: Posture, editedAnchorIndexes?: number[]): number`. Both default the new parameter to `[]`. No other task consumes these; Plan 2 does.

- [ ] **Step 1: Record the behavioral baseline**

Run: `npx vitest run --reporter=dot`
Expected: `Test Files 23 passed (23)`, `Tests 1725 passed (1725)`. Write the exact counts down. This task must not change them.

- [ ] **Step 2: Write the failing test**

Add to `src/charts/__tests__/tokenContrast.test.ts`:

```ts
import { getChartTheme } from "@/charts/echartsTheme";

describe("getChartTheme editedAnchorIndexes parameter", () => {
  it("defaults to the built-in path and accepts an explicit list", () => {
    const builtin = getChartTheme("light", "comparative", 6);
    const explicitEmpty = getChartTheme("light", "comparative", 6, []);
    expect(explicitEmpty.colorHexes).toEqual(builtin.colorHexes);

    // A non-empty list must change the cache identity, not throw.
    const edited = getChartTheme("light", "comparative", 6, [0]);
    expect(edited.colorHexes).toHaveLength(builtin.colorHexes.length);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/charts/__tests__/tokenContrast.test.ts -t "editedAnchorIndexes"`
Expected: FAIL. TypeScript rejects the 4-argument call, or the extra argument is ignored and the assertion on cache identity does not hold.

- [ ] **Step 4: Change the signature and drop the import**

In `src/charts/echartsTheme.ts`, delete line 13 (`import { getEditedAnchorIndexes } from "./manualOverrides";`) and change:

```ts
export function getChartTheme(
  theme: Theme,
  posture: Posture,
  n: number,
  editedAnchorIndexes: number[] = []
): ChartTheme {
  const cap = Math.min(POSTURE[posture].maxCategorical, MAX_SLOTS);
  const overflow = n > cap;
  const effectiveN = Math.min(n, cap);
  // Anchors the USER has edited become hard locks (see below), so they are
  // part of the cache identity. Empty (the built-in path) adds nothing but a
  // trailing "|" to the key. The caller supplies this; reading it from the
  // DOM here would couple the library to the demo app's ColorPicker.
  const key = `${theme}|${posture}|${effectiveN}|${editedAnchorIndexes.join(",")}`;
```

Leave the rest of the function body unchanged.

- [ ] **Step 5: Thread it through safeMaxN**

In `src/charts/builtinBounds.ts`, change `passesAllConstraints` and `safeMaxN` to carry the list:

```ts
function passesAllConstraints(
  theme: Theme,
  posture: Posture,
  n: number,
  editedAnchorIndexes: number[]
): boolean {
  const t = getChartTheme(theme, posture, n, editedAnchorIndexes);
  // ...body unchanged...
}

export function safeMaxN(
  theme: Theme,
  posture: Posture,
  editedAnchorIndexes: number[] = []
): number {
  const key = `${theme}|${posture}|${editedAnchorIndexes.join(",")}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const upper = Math.min(MAX_SLOTS, POSTURE[posture].maxCategorical);
  let best = 1;
  for (let n = 1; n <= upper; n++) {
    if (passesAllConstraints(theme, posture, n, editedAnchorIndexes)) best = n;
  }
  cache.set(key, best);
  return best;
}
```

- [ ] **Step 6: Update the demo callers**

In `src/pages/ChartsDemo.tsx`, every call to `getChartTheme(...)` and `safeMaxN(...)` that must honor user edits now passes `getEditedAnchorIndexes(theme)` explicitly. Find them with:

Run: `grep -n "getChartTheme(\|safeMaxN(" src/pages/ChartsDemo.tsx`

Add the import if absent: `import { getEditedAnchorIndexes } from "@/charts/manualOverrides";`

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run --reporter=dot`
Expected: 23 files pass, 1725 tests plus your new one pass. If any previously-passing test now fails, a caller was missed in Step 6. Do not adjust the test; fix the caller.

- [ ] **Step 8: Verify the circular import is gone**

Run: `grep -n "manualOverrides" src/charts/echartsTheme.ts src/charts/builtinBounds.ts`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add src/charts/echartsTheme.ts src/charts/builtinBounds.ts src/pages/ChartsDemo.tsx src/charts/__tests__/tokenContrast.test.ts
git commit -m "refactor(charts): thread editedAnchorIndexes as a parameter

Removes the circular import between echartsTheme and manualOverrides and
strips the only proprietary dependency out of echartsTheme, so the files
Plan 2 relicenses carry nothing from the demo app. Default [] is the
built-in path, which is what builtinBounds already claims to compute.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Scaffold the plugin and prove it loads

Deliverable: a plugin that imports from manifest into Figma desktop, shows three menu commands, and opens an empty panel. No color logic yet. This task exists on its own because "does the two-bundle build actually load in Figma" is a real gate a reviewer can reject independently.

**Files:**
- Create: `figma/package.json`, `figma/manifest.json`, `figma/tsconfig.json`, `figma/vite.config.sandbox.ts`, `figma/vite.config.ui.ts`, `figma/vitest.config.ts`, `figma/.gitignore`
- Create: `figma/src/sandbox/main.ts`, `figma/src/ui/index.html`, `figma/src/ui/main.tsx`, `figma/src/ui/App.tsx`
- Create: `figma/README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the `@engine` alias resolving to `<repo>/src/charts`, the `npm run build` script producing `figma/dist/code.js` and `figma/dist/ui.html`, and the three command ids `"generate" | "audit" | "simulate"` that Task 4's protocol reuses.

- [ ] **Step 1: Create the package manifest**

`figma/package.json`:

```json
{
  "name": "chart-color-figma",
  "private": true,
  "type": "module",
  "description": "The Chart Color System as a Figma plugin. Proprietary; bundles the MIT engine in-repo.",
  "scripts": {
    "build": "npm run build:sandbox && npm run build:ui",
    "build:sandbox": "vite build --config vite.config.sandbox.ts",
    "build:ui": "vite build --config vite.config.ui.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "culori": "^4.0.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.109.0",
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react-swc": "^4.3.3",
    "typescript": "^5.8.3",
    "vite": "^8.2.1",
    "vite-plugin-singlefile": "^2.1.0",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Create the Figma manifest**

`figma/manifest.json`. Note `id` is assigned by Figma on first publish; during development Figma fills it in when you import from manifest, so leave it out now.

```json
{
  "name": "Chart Color System",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "editorType": ["figma"],
  "documentAccess": "dynamic-page",
  "networkAccess": { "allowedDomains": ["none"] },
  "menu": [
    { "name": "Generate palette", "command": "generate" },
    { "name": "Audit selection", "command": "audit" },
    { "name": "Simulate vision", "command": "simulate" }
  ]
}
```

- [ ] **Step 3: Create the TypeScript config**

`figma/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "types": ["@figma/plugin-typings", "vitest/globals"],
    "baseUrl": ".",
    "paths": { "@engine/*": ["../src/charts/*"] }
  },
  "include": ["src", "vite.config.sandbox.ts", "vite.config.ui.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create the two Vite configs**

`figma/vite.config.sandbox.ts`. The sandbox has no module loader, so this must emit one self-contained IIFE file.

```ts
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: { "@engine": resolve(__dirname, "../src/charts") } },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "es2020",
    lib: { entry: resolve(__dirname, "src/sandbox/main.ts"), formats: ["iife"], name: "plugin", fileName: () => "code.js" },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
```

`figma/vite.config.ui.ts`. The UI must be one HTML file with everything inlined, because no network access means no separate asset requests.

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "src/ui"),
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { "@engine": resolve(__dirname, "../src/charts") } },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: false,
    target: "es2020",
    rollupOptions: { input: resolve(__dirname, "src/ui/index.html") },
  },
});
```

- [ ] **Step 5: Create the Vitest config**

`figma/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: { "@engine": resolve(__dirname, "../src/charts") } },
  test: { globals: true, environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 6: Create the sandbox entry**

`figma/src/sandbox/main.ts`:

```ts
// The sandbox holds the figma API and nothing else. Every decision is made by
// a pure function in ../shared and handed here as a spec to apply.
const TAB_FOR_COMMAND: Record<string, string> = {
  generate: "generate",
  audit: "audit",
  simulate: "simulate",
};

figma.showUI(__html__, { width: 420, height: 640, themeColors: true });
figma.ui.postMessage({ type: "open", tab: TAB_FOR_COMMAND[figma.command] ?? "generate" });

figma.ui.onmessage = (msg: unknown) => {
  // Task 8 replaces this with the real dispatcher.
  console.log("sandbox received", msg);
};
```

- [ ] **Step 7: Create the UI entry**

`figma/src/ui/index.html`:

```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Chart Color System</title></head>
  <body><div id="root"></div><script type="module" src="./main.tsx"></script></body>
</html>
```

`figma/src/ui/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
```

`figma/src/ui/App.tsx`:

```tsx
import { useEffect, useState } from "react";

export function App() {
  const [tab, setTab] = useState<string>("generate");

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage;
      if (msg?.type === "open") setTab(msg.tab);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 12, padding: 12 }}>
      <h1 style={{ fontSize: 13, margin: "0 0 8px" }}>Chart Color System</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>Opened on the {tab} tab. Nothing is wired up yet.</p>
    </main>
  );
}
```

- [ ] **Step 8: Create the gitignore and README**

`figma/.gitignore`:

```
dist
node_modules
```

`figma/README.md`:

```markdown
# chart-color-figma

The Chart Color System as a Figma plugin. Proprietary (see `../LICENSE`); it
bundles the MIT engine from `../src/charts` through the `@engine` alias rather
than the npm package, so it is not an npm consumer. The MCP server already
fills that role.

Declares no network access. Develop in Figma desktop: Plugins, Development,
Import plugin from manifest, then pick `figma/manifest.json`.

```bash
npm install
npm run build
npm test
```
```

- [ ] **Step 9: Install and build**

```bash
cd figma && npm install && npm run build
```
Expected: `figma/dist/code.js` and `figma/dist/ui.html` both exist. Verify `ui.html` has no external references:

Run: `grep -c 'src="\./\|href="\./' figma/dist/ui.html`
Expected: `0`.

- [ ] **Step 10: Load it in Figma desktop**

In Figma desktop: Plugins, Development, Import plugin from manifest, select `figma/manifest.json`. Run each of the three menu commands.
Expected: the panel opens at 420x640 and reads "Opened on the generate tab", "audit", or "simulate" to match the command used.

This is the gate. If the panel does not open, the build is wrong, and no later task can be verified.

- [ ] **Step 11: Commit**

```bash
git add figma/
git commit -m "feat(figma): scaffold the plugin with two builds and three commands

Sandbox builds to a self-contained IIFE, UI builds to a single inlined HTML
file, since allowedDomains none means no asset requests. Engine is reached
through an @engine alias into src/charts rather than npm.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Color boundary (`shared/color.ts`)

The only conversion between Figma's paint space and the engine's `ColorRecord`, plus alpha compositing. Pure, no `figma`, no DOM.

**Files:**
- Create: `figma/src/shared/color.ts`
- Test: `figma/src/shared/color.test.ts`

**Interfaces:**
- Consumes: `ColorRecord` and `fromCss` from `@engine/palette/distance`.
- Produces:
  - `interface FigmaRgb { r: number; g: number; b: number }`
  - `fromFigmaRgb(c: FigmaRgb): ColorRecord`
  - `toFigmaRgb(c: ColorRecord): FigmaRgb`
  - `compositeOver(fg: ColorRecord, alpha: number, bg: ColorRecord): ColorRecord`
  Tasks 5, 6, 7, 9, and 13 all consume these exact names.

- [ ] **Step 1: Write the failing tests**

`figma/src/shared/color.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fromCss } from "@engine/palette/distance";
import { fromFigmaRgb, toFigmaRgb, compositeOver } from "./color";

describe("fromFigmaRgb / toFigmaRgb", () => {
  it("round-trips 0..1 channels within 1e-6", () => {
    const samples = [
      { r: 0, g: 0, b: 0 },
      { r: 1, g: 1, b: 1 },
      { r: 0.2, g: 0.4, b: 0.6 },
      { r: 0.13333333, g: 0.77254901, b: 0.05098039 },
    ];
    for (const s of samples) {
      const back = toFigmaRgb(fromFigmaRgb(s));
      expect(Math.abs(back.r - s.r)).toBeLessThan(1e-6);
      expect(Math.abs(back.g - s.g)).toBeLessThan(1e-6);
      expect(Math.abs(back.b - s.b)).toBeLessThan(1e-6);
    }
  });

  it("produces a usable hex and oklab", () => {
    const c = fromFigmaRgb({ r: 1, g: 0, b: 0 });
    expect(c.hex).toBe("#ff0000");
    expect(c.oklab.l).toBeGreaterThan(0);
  });

  it("clamps out-of-gamut input rather than emitting NaN", () => {
    const c = fromFigmaRgb({ r: 1.4, g: -0.2, b: 0.5 });
    expect(Number.isFinite(c.oklab.l)).toBe(true);
    expect(c.rgb.r).toBeLessThanOrEqual(1);
    expect(c.rgb.g).toBeGreaterThanOrEqual(0);
  });
});

describe("compositeOver", () => {
  it("returns the foreground at alpha 1", () => {
    const fg = fromCss("#ff0000");
    const bg = fromCss("#ffffff");
    expect(compositeOver(fg, 1, bg).hex).toBe(fg.hex);
  });

  it("returns the background at alpha 0", () => {
    const fg = fromCss("#ff0000");
    const bg = fromCss("#ffffff");
    expect(compositeOver(fg, 0, bg).hex).toBe(bg.hex);
  });

  it("blends linearly in sRGB at alpha 0.5", () => {
    const out = compositeOver(fromCss("#000000"), 0.5, fromCss("#ffffff"));
    expect(Math.abs(out.rgb.r - 0.5)).toBeLessThan(1e-6);
  });

  it("clamps alpha outside 0..1", () => {
    const fg = fromCss("#ff0000");
    const bg = fromCss("#ffffff");
    expect(compositeOver(fg, 2, bg).hex).toBe(fg.hex);
    expect(compositeOver(fg, -1, bg).hex).toBe(bg.hex);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/shared/color.test.ts`
Expected: FAIL, "Failed to resolve import ./color".

- [ ] **Step 3: Implement**

`figma/src/shared/color.ts`:

```ts
import { fromCss, type ColorRecord } from "@engine/palette/distance";

/** Figma's paint colour: sRGB channels in 0..1, the same space as ColorRecord.rgb. */
export interface FigmaRgb {
  r: number;
  g: number;
  b: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Figma paint to engine ColorRecord. Percentage syntax is used rather than
 * 0-255 integers so the 0..1 channels survive without rounding; verified to
 * round-trip within 1e-6.
 */
export function fromFigmaRgb(c: FigmaRgb): ColorRecord {
  const r = clamp01(c.r) * 100;
  const g = clamp01(c.g) * 100;
  const b = clamp01(c.b) * 100;
  return fromCss(`rgb(${r}% ${g}% ${b}%)`);
}

export function toFigmaRgb(c: ColorRecord): FigmaRgb {
  return { r: clamp01(c.rgb.r), g: clamp01(c.rgb.g), b: clamp01(c.rgb.b) };
}

/**
 * Alpha-composite `fg` over `bg` in sRGB. Figma composites in sRGB, so the
 * audit must too: doing this in OKLab would report a contrast the viewer
 * never sees.
 */
export function compositeOver(fg: ColorRecord, alpha: number, bg: ColorRecord): ColorRecord {
  const a = clamp01(alpha);
  const mix = (f: number, b: number) => f * a + b * (1 - a);
  return fromFigmaRgb({
    r: mix(fg.rgb.r, bg.rgb.r),
    g: mix(fg.rgb.g, bg.rgb.g),
    b: mix(fg.rgb.b, bg.rgb.b),
  });
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/shared/color.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add figma/src/shared/color.ts figma/src/shared/color.test.ts
git commit -m "feat(figma): colour boundary between Figma paints and the engine

Percentage rgb syntax preserves the 0..1 channels exactly; compositing runs
in sRGB because that is where Figma composites, and auditing in OKLab would
report a contrast the viewer never sees.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 4: Message contract (`shared/protocol.ts`)

The typed boundary between the two contexts. Types only plus one narrowing helper, so no runtime behaviour, but every later task imports these exact names. A sandbox reply is always either `ok: true` with a payload or `ok: false` with a typed reason; no thrown strings cross the boundary.

**Files:**
- Create: `figma/src/shared/protocol.ts`
- Test: `figma/src/shared/protocol.test.ts`

**Interfaces:**
- Consumes: `FigmaRgb` from `./color`.
- Produces: `Tab`, `Request`, `Response`, `FailureReason`, `SerializedPaint`, `SerializedNode`, `BackdropLayer`, `SelectionPayload`, `PanelState`, `SimulationFrameSpec`, `WriteSummary`, and `isFailure(r: Response): r is Extract<Response, { ok: false }>`. Tasks 5 through 13 all import from here. `VariableSpec`, `WrittenRecord` and `Drift` are declared in Task 7's `spec.ts` and re-exported here so the protocol stays the single import site.

- [ ] **Step 1: Write the failing test**

`figma/src/shared/protocol.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isFailure, type Response } from "./protocol";

describe("isFailure", () => {
  it("narrows a failure reply", () => {
    const r: Response = { id: "1", ok: false, reason: "no-selection", detail: "Nothing selected." };
    expect(isFailure(r)).toBe(true);
    if (isFailure(r)) expect(r.reason).toBe("no-selection");
  });

  it("rejects a success reply", () => {
    const r: Response = { id: "1", ok: true, type: "stored" };
    expect(isFailure(r)).toBe(false);
  });

  it("every failure reason carries human detail", () => {
    const reasons: Array<Response extends infer R ? R : never> = [];
    expect(reasons).toEqual([]); // compile-time shape check only
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/shared/protocol.test.ts`
Expected: FAIL, "Failed to resolve import ./protocol".

- [ ] **Step 3: Implement**

`figma/src/shared/protocol.ts`:

```ts
import type { FigmaRgb } from "./color";
import type { VariableSpec, WrittenRecord } from "./spec";

export type { VariableSpec, WrittenRecord, Drift } from "./spec";

export type Tab = "generate" | "audit" | "simulate";

export type PaintKind = "solid" | "gradient" | "image" | "video" | "other";

export interface SerializedPaint {
  kind: PaintKind;
  visible: boolean;
  /** Paint-level opacity, 0..1. */
  opacity: number;
  blendMode: string;
  /** Present when kind is "solid". */
  color?: FigmaRgb;
  /** Present when kind is "gradient". */
  stops?: Array<{ position: number; color: FigmaRgb; alpha: number }>;
}

export interface SerializedNode {
  id: string;
  name: string;
  type: string;
  /** Node-level opacity, 0..1. */
  opacity: number;
  blendMode: string;
  /** "mixed" when Figma reports figma.mixed for the fills property. */
  fills: SerializedPaint[] | "mixed";
}

/** One ancestor of the selection, innermost first. */
export interface BackdropLayer {
  nodeId: string;
  nodeName: string;
  opacity: number;
  blendMode: string;
  fills: SerializedPaint[] | "mixed";
}

export interface SelectionPayload {
  nodes: SerializedNode[];
  backdrop: BackdropLayer[];
}

export interface PanelState {
  tab: Tab;
  n: number;
  posture: "kpi" | "comparative" | "exploratory";
  sequentialSteps: number;
  divergingSteps: number;
  /** Hex, when the designer supplied one explicitly. */
  explicitBackground: string | null;
}

export interface SimulationFrameSpec {
  sourceNodeId: string;
  label: string;
  /** Replacement colour per (nodeId, fillIndex) found in the source subtree. */
  replacements: Array<{ nodeId: string; fillIndex: number; color: FigmaRgb }>;
  offsetX: number;
}

export interface WriteSummary {
  collectionId: string;
  created: number;
  updated: number;
  /** True when addMode hit the plan limit and a second collection was used. */
  usedFallbackCollection: boolean;
  fallbackCollectionId: string | null;
}

export type FailureReason =
  | "no-selection"
  | "no-auditable-fills"
  | "background-unresolvable"
  | "mode-limit"
  | "storage-unavailable"
  | "figma-error";

export type Request =
  | { id: string; type: "read-selection" }
  | { id: string; type: "read-written-record" }
  | { id: string; type: "write-variables"; specs: VariableSpec[]; record: WrittenRecord; confirmedOverwrites: string[] }
  | { id: string; type: "render-simulation"; frames: SimulationFrameSpec[] }
  | { id: string; type: "store-get" }
  | { id: string; type: "store-set"; state: PanelState };

export type Response =
  | { id: string; ok: true; type: "selection"; payload: SelectionPayload }
  | { id: string; ok: true; type: "written-record"; payload: WrittenRecord | null }
  | { id: string; ok: true; type: "variables-written"; payload: WriteSummary }
  | { id: string; ok: true; type: "simulation-rendered"; payload: { frameIds: string[] } }
  | { id: string; ok: true; type: "store"; payload: PanelState | null }
  | { id: string; ok: true; type: "stored" }
  | { id: string; ok: false; reason: FailureReason; detail: string };

/** Pushed by the sandbox on launch so the UI opens on the invoked command. */
export interface OpenMessage {
  type: "open";
  tab: Tab;
}

export function isFailure(r: Response): r is Extract<Response, { ok: false }> {
  return r.ok === false;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/shared/protocol.test.ts`
Expected: PASS. Note this task's test file imports `./spec`, which Task 7 creates; if TypeScript complains about the missing module, create Task 7 first or add a temporary `export interface VariableSpec {}` stub and remove it in Task 7. Prefer doing Task 7 first if you are working out of order.

- [ ] **Step 5: Commit**

```bash
git add figma/src/shared/protocol.ts figma/src/shared/protocol.test.ts
git commit -m "feat(figma): typed message contract between sandbox and UI

Every sandbox reply is ok true with a payload or ok false with a typed
reason. No thrown strings cross the boundary.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Fill extraction (`shared/fills.ts`)

Turn serialized nodes into a list of things that can be audited and things that cannot, each with a reason. This is where the audit's honesty lives: it must be easier to refuse than to guess.

**Files:**
- Create: `figma/src/shared/fills.ts`
- Test: `figma/src/shared/fills.test.ts`

**Interfaces:**
- Consumes: `SerializedNode`, `SerializedPaint` from `./protocol`; `fromFigmaRgb` from `./color`.
- Produces:
  - `type SkipReason = "hidden" | "mixed-fills" | "no-fills" | "image-fill" | "video-fill" | "unknown-fill" | "non-normal-blend"`
  - `interface ExtractedFill { nodeId: string; nodeName: string; status: "auditable" | "skipped"; source: "solid" | "gradient-stop"; color?: ColorRecord; alpha?: number; stopIndex?: number; reason?: SkipReason }`
  - `extractFills(nodes: SerializedNode[]): ExtractedFill[]`
  Task 12 consumes these.

- [ ] **Step 1: Write the failing tests**

`figma/src/shared/fills.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractFills } from "./fills";
import type { SerializedNode, SerializedPaint } from "./protocol";

const solid = (r: number, g: number, b: number, o = 1): SerializedPaint => ({
  kind: "solid", visible: true, opacity: o, blendMode: "NORMAL", color: { r, g, b },
});
const node = (over: Partial<SerializedNode> = {}): SerializedNode => ({
  id: "n1", name: "Bar", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [solid(1, 0, 0)], ...over,
});

describe("extractFills", () => {
  it("extracts a plain solid fill as auditable", () => {
    const out = extractFills([node()]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("auditable");
    expect(out[0].color!.hex).toBe("#ff0000");
    expect(out[0].alpha).toBe(1);
  });

  it("multiplies paint opacity by node opacity", () => {
    const out = extractFills([node({ opacity: 0.5, fills: [solid(1, 0, 0, 0.5)] })]);
    expect(out[0].alpha).toBeCloseTo(0.25, 6);
  });

  it("emits one entry per gradient stop, never an average", () => {
    const grad: SerializedPaint = {
      kind: "gradient", visible: true, opacity: 1, blendMode: "NORMAL",
      stops: [
        { position: 0, color: { r: 0, g: 0, b: 0 }, alpha: 1 },
        { position: 1, color: { r: 1, g: 1, b: 1 }, alpha: 1 },
      ],
    };
    const out = extractFills([node({ fills: [grad] })]);
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.source === "gradient-stop")).toBe(true);
    expect(out.map((e) => e.stopIndex)).toEqual([0, 1]);
    expect(out.map((e) => e.color!.hex)).toEqual(["#000000", "#ffffff"]);
  });

  it("refuses image fills with a reason and no colour", () => {
    const img: SerializedPaint = { kind: "image", visible: true, opacity: 1, blendMode: "NORMAL" };
    const out = extractFills([node({ fills: [img] })]);
    expect(out[0].status).toBe("skipped");
    expect(out[0].reason).toBe("image-fill");
    expect(out[0].color).toBeUndefined();
  });

  it("skips non-normal blend modes rather than auditing them", () => {
    const out = extractFills([node({ fills: [{ ...solid(1, 0, 0), blendMode: "MULTIPLY" }] })]);
    expect(out[0].status).toBe("skipped");
    expect(out[0].reason).toBe("non-normal-blend");
  });

  it("skips a node whose own blend mode is not normal", () => {
    const out = extractFills([node({ blendMode: "SCREEN" })]);
    expect(out[0].reason).toBe("non-normal-blend");
  });

  it("skips invisible paints", () => {
    const out = extractFills([node({ fills: [{ ...solid(1, 0, 0), visible: false }] })]);
    expect(out[0].reason).toBe("hidden");
  });

  it("reports mixed fills rather than picking one", () => {
    const out = extractFills([node({ fills: "mixed" })]);
    expect(out[0].reason).toBe("mixed-fills");
  });

  it("reports a node with no fills at all", () => {
    const out = extractFills([node({ fills: [] })]);
    expect(out[0].reason).toBe("no-fills");
  });

  it("never returns an empty array for a non-empty selection", () => {
    const out = extractFills([node({ fills: [] }), node({ id: "n2", fills: "mixed" })]);
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/shared/fills.test.ts`
Expected: FAIL, "Failed to resolve import ./fills".

- [ ] **Step 3: Implement**

`figma/src/shared/fills.ts`:

```ts
import type { ColorRecord } from "@engine/palette/distance";
import { fromFigmaRgb } from "./color";
import type { SerializedNode, SerializedPaint } from "./protocol";

export type SkipReason =
  | "hidden"
  | "mixed-fills"
  | "no-fills"
  | "image-fill"
  | "video-fill"
  | "unknown-fill"
  | "non-normal-blend";

export interface ExtractedFill {
  nodeId: string;
  nodeName: string;
  status: "auditable" | "skipped";
  source: "solid" | "gradient-stop";
  color?: ColorRecord;
  /** Paint opacity multiplied by node opacity. */
  alpha?: number;
  stopIndex?: number;
  reason?: SkipReason;
}

const skip = (n: SerializedNode, reason: SkipReason): ExtractedFill => ({
  nodeId: n.id,
  nodeName: n.name,
  status: "skipped",
  source: "solid",
  reason,
});

function fromPaint(n: SerializedNode, p: SerializedPaint): ExtractedFill[] {
  if (!p.visible) return [skip(n, "hidden")];
  if (p.blendMode !== "NORMAL") return [skip(n, "non-normal-blend")];

  if (p.kind === "solid" && p.color) {
    return [{
      nodeId: n.id,
      nodeName: n.name,
      status: "auditable",
      source: "solid",
      color: fromFigmaRgb(p.color),
      alpha: p.opacity * n.opacity,
    }];
  }

  if (p.kind === "gradient" && p.stops) {
    // Each stop is audited on its own. Averaging a gradient would report a
    // contrast that exists nowhere on the shape.
    return p.stops.map((s, i) => ({
      nodeId: n.id,
      nodeName: n.name,
      status: "auditable" as const,
      source: "gradient-stop" as const,
      color: fromFigmaRgb(s.color),
      alpha: s.alpha * p.opacity * n.opacity,
      stopIndex: i,
    }));
  }

  if (p.kind === "image") return [skip(n, "image-fill")];
  if (p.kind === "video") return [skip(n, "video-fill")];
  return [skip(n, "unknown-fill")];
}

/**
 * Every node produces at least one entry, so the UI can always say what was
 * found and why it was skipped rather than reporting "0 results".
 */
export function extractFills(nodes: SerializedNode[]): ExtractedFill[] {
  const out: ExtractedFill[] = [];
  for (const n of nodes) {
    if (n.blendMode !== "NORMAL") { out.push(skip(n, "non-normal-blend")); continue; }
    if (n.fills === "mixed") { out.push(skip(n, "mixed-fills")); continue; }
    if (n.fills.length === 0) { out.push(skip(n, "no-fills")); continue; }
    for (const p of n.fills) out.push(...fromPaint(n, p));
  }
  return out;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/shared/fills.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add figma/src/shared/fills.ts figma/src/shared/fills.test.ts
git commit -m "feat(figma): fill extraction with an explicit skip reason per node

Every node yields at least one entry so the UI can say what was found and
why it was skipped, never '0 results'. Gradient stops are audited
individually; averaging would report a contrast that exists nowhere.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Background resolution (`shared/background.ts`)

One resolver and one refusal set, used by both Generate and Audit. Holding these two commands to different standards was a defect in an earlier draft of the spec; this module is how they are held to the same one.

**Files:**
- Create: `figma/src/shared/background.ts`
- Test: `figma/src/shared/background.test.ts`

**Interfaces:**
- Consumes: `BackdropLayer`, `SerializedPaint` from `./protocol`; `fromFigmaRgb`, `compositeOver` from `./color`.
- Produces:
  - `type BackgroundRefusal = "empty-chain" | "no-opaque-backdrop" | "image-backdrop" | "gradient-backdrop" | "non-normal-blend" | "mixed-fills"`
  - `type BackgroundResolution = { ok: true; color: ColorRecord; fromNodeId: string } | { ok: false; reason: BackgroundRefusal }`
  - `resolveBackground(chain: BackdropLayer[]): BackgroundResolution`
  - `BACKGROUND_REFUSAL_COPY: Record<BackgroundRefusal, string>`
  Tasks 11 and 12 consume all four.

- [ ] **Step 1: Write the failing tests**

`figma/src/shared/background.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveBackground, BACKGROUND_REFUSAL_COPY } from "./background";
import type { BackdropLayer, SerializedPaint } from "./protocol";

const solid = (r: number, g: number, b: number, o = 1): SerializedPaint => ({
  kind: "solid", visible: true, opacity: o, blendMode: "NORMAL", color: { r, g, b },
});
const layer = (over: Partial<BackdropLayer> = {}): BackdropLayer => ({
  nodeId: "f1", nodeName: "Frame", opacity: 1, blendMode: "NORMAL", fills: [solid(1, 1, 1)], ...over,
});

describe("resolveBackground", () => {
  it("refuses an empty chain", () => {
    expect(resolveBackground([])).toEqual({ ok: false, reason: "empty-chain" });
  });

  it("returns the innermost fully opaque backdrop", () => {
    const r = resolveBackground([layer({ nodeId: "inner", fills: [solid(0, 0, 0)] }), layer({ nodeId: "outer" })]);
    expect(r).toEqual({ ok: true, color: expect.objectContaining({ hex: "#000000" }), fromNodeId: "inner" });
  });

  it("composites a translucent backdrop over the opaque one behind it", () => {
    const r = resolveBackground([
      layer({ nodeId: "inner", opacity: 0.5, fills: [solid(0, 0, 0)] }),
      layer({ nodeId: "outer", fills: [solid(1, 1, 1)] }),
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Math.abs(r.color.rgb.r - 0.5)).toBeLessThan(1e-6);
  });

  it("skips layers with no fills and keeps walking outward", () => {
    const r = resolveBackground([layer({ nodeId: "inner", fills: [] }), layer({ nodeId: "outer", fills: [solid(0, 1, 0)] })]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fromNodeId).toBe("outer");
  });

  it("refuses when the chain reaches the end without an opaque backdrop", () => {
    const r = resolveBackground([layer({ opacity: 0.5 }), layer({ nodeId: "outer", opacity: 0.5 })]);
    expect(r).toEqual({ ok: false, reason: "no-opaque-backdrop" });
  });

  it("refuses an image backdrop instead of guessing", () => {
    const img: SerializedPaint = { kind: "image", visible: true, opacity: 1, blendMode: "NORMAL" };
    expect(resolveBackground([layer({ fills: [img] })])).toEqual({ ok: false, reason: "image-backdrop" });
  });

  it("refuses a gradient backdrop, which has no single background colour", () => {
    const grad: SerializedPaint = {
      kind: "gradient", visible: true, opacity: 1, blendMode: "NORMAL",
      stops: [{ position: 0, color: { r: 0, g: 0, b: 0 }, alpha: 1 }],
    };
    expect(resolveBackground([layer({ fills: [grad] })])).toEqual({ ok: false, reason: "gradient-backdrop" });
  });

  it("refuses a non-normal blend mode anywhere in the chain", () => {
    expect(resolveBackground([layer({ blendMode: "MULTIPLY" })])).toEqual({ ok: false, reason: "non-normal-blend" });
  });

  it("refuses mixed fills", () => {
    expect(resolveBackground([layer({ fills: "mixed" })])).toEqual({ ok: false, reason: "mixed-fills" });
  });

  it("has human copy for every refusal, with no em dashes", () => {
    const reasons = ["empty-chain", "no-opaque-backdrop", "image-backdrop", "gradient-backdrop", "non-normal-blend", "mixed-fills"] as const;
    for (const r of reasons) {
      expect(BACKGROUND_REFUSAL_COPY[r]).toBeTruthy();
      expect(BACKGROUND_REFUSAL_COPY[r]).not.toContain("\u2014");
    }
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/shared/background.test.ts`
Expected: FAIL, "Failed to resolve import ./background".

- [ ] **Step 3: Implement**

`figma/src/shared/background.ts`:

```ts
import type { ColorRecord } from "@engine/palette/distance";
import { compositeOver, fromFigmaRgb } from "./color";
import type { BackdropLayer, SerializedPaint } from "./protocol";

export type BackgroundRefusal =
  | "empty-chain"
  | "no-opaque-backdrop"
  | "image-backdrop"
  | "gradient-backdrop"
  | "non-normal-blend"
  | "mixed-fills";

export type BackgroundResolution =
  | { ok: true; color: ColorRecord; fromNodeId: string }
  | { ok: false; reason: BackgroundRefusal };

export const BACKGROUND_REFUSAL_COPY: Record<BackgroundRefusal, string> = {
  "empty-chain": "Nothing sits behind this selection, so there is no background to measure against.",
  "no-opaque-backdrop": "Every layer behind this selection is see-through, so the background is whatever the canvas shows. Set one explicitly.",
  "image-backdrop": "The backdrop is an image. Contrast against a photograph is not a number this tool can defend. Set a background explicitly.",
  "gradient-backdrop": "The backdrop is a gradient, so there is no single background colour. Set one explicitly.",
  "non-normal-blend": "A layer behind this selection uses a blend mode other than Normal, which changes the colour that actually reaches the eye.",
  "mixed-fills": "A layer behind this selection has mixed fills, so its background colour is ambiguous.",
};

function firstVisiblePaint(fills: SerializedPaint[]): SerializedPaint | null {
  for (const p of fills) if (p.visible) return p;
  return null;
}

/**
 * Walk outward from the selection until a fully opaque backdrop is found,
 * compositing translucent layers on the way. Refuses rather than assuming:
 * an audit against a guessed background is a false accessibility claim, and
 * a palette solved against one is the same claim wearing a different hat.
 *
 * @param chain ancestors of the selection, innermost first.
 */
export function resolveBackground(chain: BackdropLayer[]): BackgroundResolution {
  if (chain.length === 0) return { ok: false, reason: "empty-chain" };

  // Layers that are translucent, collected innermost-first for compositing.
  const pending: Array<{ color: ColorRecord; alpha: number }> = [];

  for (const layer of chain) {
    if (layer.blendMode !== "NORMAL") return { ok: false, reason: "non-normal-blend" };
    if (layer.fills === "mixed") return { ok: false, reason: "mixed-fills" };

    const paint = firstVisiblePaint(layer.fills);
    if (!paint) continue; // no visible fill: keep walking outward

    if (paint.blendMode !== "NORMAL") return { ok: false, reason: "non-normal-blend" };
    if (paint.kind === "image" || paint.kind === "video") return { ok: false, reason: "image-backdrop" };
    if (paint.kind === "gradient") return { ok: false, reason: "gradient-backdrop" };
    if (paint.kind !== "solid" || !paint.color) return { ok: false, reason: "no-opaque-backdrop" };

    const alpha = paint.opacity * layer.opacity;
    const color = fromFigmaRgb(paint.color);

    if (alpha >= 1) {
      // Composite the translucent layers we passed, innermost last.
      let resolved = color;
      for (let i = pending.length - 1; i >= 0; i--) {
        resolved = compositeOver(pending[i].color, pending[i].alpha, resolved);
      }
      return { ok: true, color: resolved, fromNodeId: layer.nodeId };
    }

    pending.push({ color, alpha });
  }

  return { ok: false, reason: "no-opaque-backdrop" };
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/shared/background.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add figma/src/shared/background.ts figma/src/shared/background.test.ts
git commit -m "feat(figma): one background resolver and refusal set for both commands

Generate and Audit now face the same standard. Refuses image, gradient,
non-normal-blend and see-through-to-canvas backdrops rather than assuming a
token, because an audit against a guessed background is a false
accessibility claim and a palette solved against one is the same claim.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 7: Variable spec and drift detection (`shared/spec.ts`)

Turn a solved palette into the exact variable set to write, and detect when a designer has hand-edited a value since the plugin last wrote it. The dash, decal, and shape variables are reference values, never bindings: `VariableBindableNodeField` has 27 members and no dash field. Decal additionally never renders in Figma at all, because Figma discards `<pattern>` fills.

**Files:**
- Create: `figma/src/shared/spec.ts`
- Test: `figma/src/shared/spec.test.ts`

**Interfaces:**
- Consumes: `ColorRecord` from `@engine/palette/distance`; `dashScale`, `decalScale`, `shapeScale` from `@engine/encoding`; `FigmaRgb`, `toFigmaRgb` from `./color`.
- Produces:
  - `type VariableKind = "COLOR" | "STRING"`
  - `interface VariableSpec { name: string; kind: VariableKind; light: FigmaRgb | string; dark: FigmaRgb | string }`
  - `interface ThemeInput { palette: ColorRecord[]; surface: ColorRecord; grid: ColorRecord; axis: ColorRecord; label: ColorRecord; sequential?: ColorRecord[]; diverging?: ColorRecord[] }`
  - `buildVariableSpec(input: { light: ThemeInput; dark: ThemeInput }): VariableSpec[]`
  - `type WrittenRecord = Record<string, { light: string; dark: string }>`
  - `interface Drift { name: string; mode: "light" | "dark"; recorded: string; current: string }`
  - `recordFromSpecs(specs: VariableSpec[]): WrittenRecord`
  - `diffWritten(recorded: WrittenRecord, current: WrittenRecord): Drift[]`
  - `formatDash(d: "solid" | number[]): string`
  Tasks 9 and 11 consume these.

- [ ] **Step 1: Write the failing tests**

`figma/src/shared/spec.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fromCss } from "@engine/palette/distance";
import { MAX_SLOTS } from "@engine/encoding";
import { buildVariableSpec, recordFromSpecs, diffWritten, formatDash, type ThemeInput } from "./spec";

const c = (hex: string) => fromCss(hex);
const theme = (n: number, base: string): ThemeInput => ({
  palette: Array.from({ length: n }, (_, i) => c(`hsl(${(i * 30) % 360} 60% ${base === "light" ? 40 : 70}%)`)),
  surface: c(base === "light" ? "#ffffff" : "#111111"),
  grid: c("#888888"),
  axis: c("#666666"),
  label: c(base === "light" ? "#222222" : "#eeeeee"),
});

describe("formatDash", () => {
  it("renders solid and arrays in a form a designer can retype", () => {
    expect(formatDash("solid")).toBe("solid");
    expect(formatDash([6, 3])).toBe("6 3");
    expect(formatDash([10, 3, 2, 3])).toBe("10 3 2 3");
  });
});

describe("buildVariableSpec", () => {
  const specs = buildVariableSpec({ light: theme(4, "light"), dark: theme(4, "dark") });
  const names = specs.map((s) => s.name);

  it("emits four variables per series slot", () => {
    for (let i = 1; i <= 4; i++) {
      expect(names).toContain(`chart/series/${i}/color`);
      expect(names).toContain(`chart/series/${i}/dash`);
      expect(names).toContain(`chart/series/${i}/decal`);
      expect(names).toContain(`chart/series/${i}/shape`);
    }
  });

  it("emits the four chrome tokens", () => {
    for (const t of ["surface", "grid", "axis", "label"]) expect(names).toContain(`chart/${t}`);
  });

  it("types colours as COLOR and encodings as STRING", () => {
    expect(specs.find((s) => s.name === "chart/series/1/color")!.kind).toBe("COLOR");
    expect(specs.find((s) => s.name === "chart/series/1/dash")!.kind).toBe("STRING");
  });

  it("gives every variable both a light and a dark value", () => {
    for (const s of specs) {
      expect(s.light).toBeDefined();
      expect(s.dark).toBeDefined();
    }
  });

  it("uses the same encoding value in both modes, since encodings do not vary by theme", () => {
    const dash = specs.find((s) => s.name === "chart/series/2/dash")!;
    expect(dash.light).toBe(dash.dark);
  });

  it("differs by mode for colours", () => {
    const col = specs.find((s) => s.name === "chart/surface")!;
    expect(col.light).not.toEqual(col.dark);
  });

  it("omits ramp variables when no ramp is supplied", () => {
    expect(names.some((n) => n.startsWith("chart/sequential/"))).toBe(false);
    expect(names.some((n) => n.startsWith("chart/diverging/"))).toBe(false);
  });

  it("emits ramp variables when supplied", () => {
    const withRamp = buildVariableSpec({
      light: { ...theme(3, "light"), sequential: [c("#eef"), c("#88f"), c("#00f")] },
      dark: { ...theme(3, "dark"), sequential: [c("#001"), c("#33a"), c("#aaf")] },
    });
    expect(withRamp.map((s) => s.name)).toContain("chart/sequential/3");
  });

  it("throws when the two modes disagree on slot count", () => {
    expect(() => buildVariableSpec({ light: theme(3, "light"), dark: theme(4, "dark") })).toThrow(/slot count/i);
  });

  it("never emits more series slots than MAX_SLOTS", () => {
    const big = buildVariableSpec({ light: theme(MAX_SLOTS, "light"), dark: theme(MAX_SLOTS, "dark") });
    expect(big.filter((s) => s.name.endsWith("/color") && s.name.startsWith("chart/series/"))).toHaveLength(MAX_SLOTS);
  });
});

describe("diffWritten", () => {
  const specs = buildVariableSpec({ light: theme(2, "light"), dark: theme(2, "dark") });
  const recorded = recordFromSpecs(specs);

  it("reports nothing when nothing changed", () => {
    expect(diffWritten(recorded, recorded)).toEqual([]);
  });

  it("reports a hand edit in one mode only", () => {
    const current = structuredClone(recorded);
    current["chart/series/1/color"].light = "#123456";
    const drift = diffWritten(recorded, current);
    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ name: "chart/series/1/color", mode: "light", current: "#123456" });
  });

  it("ignores variables the plugin never wrote", () => {
    const current = { ...structuredClone(recorded), "someone/elses/var": { light: "#000000", dark: "#ffffff" } };
    expect(diffWritten(recorded, current)).toEqual([]);
  });

  it("does not report a variable that has since been deleted", () => {
    const current = structuredClone(recorded);
    delete current["chart/series/1/dash"];
    expect(diffWritten(recorded, current)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/shared/spec.test.ts`
Expected: FAIL, "Failed to resolve import ./spec".

- [ ] **Step 3: Implement**

`figma/src/shared/spec.ts`:

```ts
import type { ColorRecord } from "@engine/palette/distance";
import { dashScale, decalScale, shapeScale, MAX_SLOTS } from "@engine/encoding";
import { toFigmaRgb, type FigmaRgb } from "./color";

export type VariableKind = "COLOR" | "STRING";

export interface VariableSpec {
  name: string;
  kind: VariableKind;
  light: FigmaRgb | string;
  dark: FigmaRgb | string;
}

export interface ThemeInput {
  palette: ColorRecord[];
  surface: ColorRecord;
  grid: ColorRecord;
  axis: ColorRecord;
  label: ColorRecord;
  sequential?: ColorRecord[];
  diverging?: ColorRecord[];
}

/** A dash the designer can retype into Figma's stroke panel. */
export function formatDash(d: "solid" | number[]): string {
  return d === "solid" ? "solid" : d.join(" ");
}

/** A readable label for a decal. Never rendered in Figma; see C3 in the spec. */
function describeDecal(d: (typeof decalScale)[number]): string {
  if (d.symbol === "none") return "none";
  if (d.symbol !== "rect") return `${d.symbol}s`;
  const deg = Math.round((d.rotation * 180) / Math.PI);
  if (deg === 0) return "horizontal lines";
  if (deg === 90) return "vertical lines";
  return `diagonal lines ${deg} deg`;
}

const color = (name: string, light: ColorRecord, dark: ColorRecord): VariableSpec => ({
  name, kind: "COLOR", light: toFigmaRgb(light), dark: toFigmaRgb(dark),
});

const text = (name: string, value: string): VariableSpec => ({
  name, kind: "STRING", light: value, dark: value,
});

/**
 * Colour variables are bindable. The dash, decal and shape variables are
 * reference values a designer reads and retypes: VariableBindableNodeField
 * has 27 members and no dash field. Decal additionally never renders in
 * Figma, because Figma discards <pattern> fills on SVG import.
 */
export function buildVariableSpec(input: { light: ThemeInput; dark: ThemeInput }): VariableSpec[] {
  const { light, dark } = input;
  if (light.palette.length !== dark.palette.length) {
    throw new Error(
      `Light and dark disagree on slot count: ${light.palette.length} vs ${dark.palette.length}.`
    );
  }
  const n = Math.min(light.palette.length, MAX_SLOTS);
  const specs: VariableSpec[] = [];

  for (let i = 0; i < n; i++) {
    const slot = i + 1;
    specs.push(color(`chart/series/${slot}/color`, light.palette[i], dark.palette[i]));
    specs.push(text(`chart/series/${slot}/dash`, formatDash(dashScale[i])));
    specs.push(text(`chart/series/${slot}/decal`, describeDecal(decalScale[i])));
    specs.push(text(`chart/series/${slot}/shape`, shapeScale[i]));
  }

  specs.push(color("chart/surface", light.surface, dark.surface));
  specs.push(color("chart/grid", light.grid, dark.grid));
  specs.push(color("chart/axis", light.axis, dark.axis));
  specs.push(color("chart/label", light.label, dark.label));

  const ramp = (key: "sequential" | "diverging") => {
    const l = light[key];
    const d = dark[key];
    if (!l || !d) return;
    const steps = Math.min(l.length, d.length);
    for (let i = 0; i < steps; i++) specs.push(color(`chart/${key}/${i + 1}`, l[i], d[i]));
  };
  ramp("sequential");
  ramp("diverging");

  return specs;
}

export type WrittenRecord = Record<string, { light: string; dark: string }>;

export interface Drift {
  name: string;
  mode: "light" | "dark";
  recorded: string;
  current: string;
}

const asRecordValue = (v: FigmaRgb | string): string =>
  typeof v === "string" ? v : `rgb(${v.r} ${v.g} ${v.b})`;

export function recordFromSpecs(specs: VariableSpec[]): WrittenRecord {
  const out: WrittenRecord = {};
  for (const s of specs) out[s.name] = { light: asRecordValue(s.light), dark: asRecordValue(s.dark) };
  return out;
}

/**
 * Variables whose current value differs from what the plugin last wrote.
 * Only names the plugin wrote are considered: a designer's own variables are
 * none of its business, and a variable that has since been deleted is not
 * drift. JTBD-8 is a per-user colour pin, so these are presented for
 * confirmation rather than overwritten.
 */
export function diffWritten(recorded: WrittenRecord, current: WrittenRecord): Drift[] {
  const out: Drift[] = [];
  for (const [name, was] of Object.entries(recorded)) {
    const now = current[name];
    if (!now) continue;
    (["light", "dark"] as const).forEach((mode) => {
      if (now[mode] !== was[mode]) out.push({ name, mode, recorded: was[mode], current: now[mode] });
    });
  }
  return out;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/shared/spec.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add figma/src/shared/spec.ts figma/src/shared/spec.test.ts
git commit -m "feat(figma): variable spec builder and hand-edit drift detection

Colour variables are bindable; dash, decal and shape are reference values,
since VariableBindableNodeField has no dash field. Drift detection covers
only names the plugin itself wrote, so a designer's own variables and their
deletions are left alone.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Selection serialization and the dispatcher (`sandbox/`)

The sandbox walks the selection and its ancestor chain, flattens both into the plain shapes the pure modules expect, and replies. It makes no decisions.

**Files:**
- Create: `figma/src/sandbox/selection.ts`
- Modify: `figma/src/sandbox/main.ts` (replace the stub handler)
- Test: `figma/src/sandbox/selection.test.ts`

**Interfaces:**
- Consumes: `SerializedNode`, `SerializedPaint`, `BackdropLayer`, `SelectionPayload`, `Request`, `Response` from `../shared/protocol`.
- Produces:
  - `serializePaint(p: unknown): SerializedPaint`
  - `serializeNode(n: unknown): SerializedNode`
  - `collectBackdrop(node: unknown): BackdropLayer[]`
  - `readSelection(): SelectionPayload` (touches `figma`, not unit-tested)
  - `reply(res: Response): void`
  Tasks 9, 10, and 13 register handlers on the dispatcher in `main.ts`.

- [ ] **Step 1: Write the failing tests**

The serializers take duck-typed objects so they can be tested with plain literals and no `figma` global.

`figma/src/sandbox/selection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { serializePaint, serializeNode, collectBackdrop } from "./selection";

describe("serializePaint", () => {
  it("maps a SOLID paint", () => {
    const p = serializePaint({ type: "SOLID", visible: true, opacity: 0.5, blendMode: "NORMAL", color: { r: 1, g: 0, b: 0 } });
    expect(p).toEqual({ kind: "solid", visible: true, opacity: 0.5, blendMode: "NORMAL", color: { r: 1, g: 0, b: 0 } });
  });

  it("defaults a missing visible to true and a missing opacity to 1", () => {
    const p = serializePaint({ type: "SOLID", blendMode: "NORMAL", color: { r: 0, g: 0, b: 0 } });
    expect(p.visible).toBe(true);
    expect(p.opacity).toBe(1);
  });

  it("maps every gradient type to one kind, carrying its stops", () => {
    for (const t of ["GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"]) {
      const p = serializePaint({
        type: t, visible: true, opacity: 1, blendMode: "NORMAL",
        gradientStops: [{ position: 0, color: { r: 1, g: 1, b: 1, a: 0.4 } }],
      });
      expect(p.kind).toBe("gradient");
      expect(p.stops).toEqual([{ position: 0, color: { r: 1, g: 1, b: 1 }, alpha: 0.4 }]);
    }
  });

  it("maps IMAGE and VIDEO distinctly and anything else to other", () => {
    expect(serializePaint({ type: "IMAGE" }).kind).toBe("image");
    expect(serializePaint({ type: "VIDEO" }).kind).toBe("video");
    expect(serializePaint({ type: "SOMETHING_NEW" }).kind).toBe("other");
  });
});

describe("serializeNode", () => {
  it("flattens a node with fills", () => {
    const n = serializeNode({
      id: "1:2", name: "Bar", type: "RECTANGLE", opacity: 0.8, blendMode: "NORMAL",
      fills: [{ type: "SOLID", visible: true, opacity: 1, blendMode: "NORMAL", color: { r: 0, g: 0, b: 1 } }],
    });
    expect(n.id).toBe("1:2");
    expect(n.fills).toHaveLength(1);
  });

  it("reports a symbol fills value as mixed", () => {
    const n = serializeNode({ id: "1:3", name: "X", type: "FRAME", opacity: 1, blendMode: "NORMAL", fills: Symbol("mixed") });
    expect(n.fills).toBe("mixed");
  });

  it("treats a node with no fills property as having none", () => {
    const n = serializeNode({ id: "1:4", name: "G", type: "GROUP", opacity: 1, blendMode: "NORMAL" });
    expect(n.fills).toEqual([]);
  });
});

describe("collectBackdrop", () => {
  it("walks parents innermost first and stops at the page", () => {
    const page = { id: "0:1", name: "Page 1", type: "PAGE", opacity: 1, blendMode: "NORMAL", parent: null };
    const outer = { id: "1:1", name: "Outer", type: "FRAME", opacity: 1, blendMode: "NORMAL", fills: [], parent: page };
    const inner = { id: "1:2", name: "Inner", type: "FRAME", opacity: 1, blendMode: "NORMAL", fills: [], parent: outer };
    const leaf = { id: "1:3", name: "Bar", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [], parent: inner };

    const chain = collectBackdrop(leaf);
    expect(chain.map((l) => l.nodeId)).toEqual(["1:2", "1:1"]);
  });

  it("returns an empty chain for a node parented straight to the page", () => {
    const page = { id: "0:1", name: "Page 1", type: "PAGE", parent: null };
    expect(collectBackdrop({ id: "1:9", name: "Loose", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [], parent: page })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/sandbox/selection.test.ts`
Expected: FAIL, "Failed to resolve import ./selection".

- [ ] **Step 3: Implement the serializers**

`figma/src/sandbox/selection.ts`:

```ts
import type {
  BackdropLayer, PaintKind, Request, Response, SelectionPayload, SerializedNode, SerializedPaint,
} from "../shared/protocol";

type Loose = Record<string, any>;

const PAINT_KIND: Record<string, PaintKind> = {
  SOLID: "solid",
  GRADIENT_LINEAR: "gradient",
  GRADIENT_RADIAL: "gradient",
  GRADIENT_ANGULAR: "gradient",
  GRADIENT_DIAMOND: "gradient",
  IMAGE: "image",
  VIDEO: "video",
};

export function serializePaint(p: unknown): SerializedPaint {
  const q = (p ?? {}) as Loose;
  const kind = PAINT_KIND[q.type as string] ?? "other";
  const base: SerializedPaint = {
    kind,
    visible: q.visible !== false,
    opacity: typeof q.opacity === "number" ? q.opacity : 1,
    blendMode: typeof q.blendMode === "string" ? q.blendMode : "NORMAL",
  };
  if (kind === "solid" && q.color) base.color = { r: q.color.r, g: q.color.g, b: q.color.b };
  if (kind === "gradient" && Array.isArray(q.gradientStops)) {
    base.stops = q.gradientStops.map((s: Loose) => ({
      position: s.position,
      color: { r: s.color.r, g: s.color.g, b: s.color.b },
      alpha: typeof s.color.a === "number" ? s.color.a : 1,
    }));
  }
  return base;
}

function serializeFills(fills: unknown): SerializedPaint[] | "mixed" {
  // figma.mixed is a unique symbol; anything non-array and non-undefined is mixed.
  if (fills === undefined || fills === null) return [];
  if (!Array.isArray(fills)) return "mixed";
  return fills.map(serializePaint);
}

export function serializeNode(n: unknown): SerializedNode {
  const q = (n ?? {}) as Loose;
  return {
    id: q.id,
    name: q.name,
    type: q.type,
    opacity: typeof q.opacity === "number" ? q.opacity : 1,
    blendMode: typeof q.blendMode === "string" ? q.blendMode : "NORMAL",
    fills: serializeFills(q.fills),
  };
}

/** Ancestors of `node`, innermost first, stopping before PAGE and DOCUMENT. */
export function collectBackdrop(node: unknown): BackdropLayer[] {
  const out: BackdropLayer[] = [];
  let cur = ((node ?? {}) as Loose).parent as Loose | null | undefined;
  while (cur && cur.type !== "PAGE" && cur.type !== "DOCUMENT") {
    out.push({
      nodeId: cur.id,
      nodeName: cur.name,
      opacity: typeof cur.opacity === "number" ? cur.opacity : 1,
      blendMode: typeof cur.blendMode === "string" ? cur.blendMode : "NORMAL",
      fills: serializeFills(cur.fills),
    });
    cur = cur.parent as Loose | null | undefined;
  }
  return out;
}

/** Flatten the selection, descending into containers. Touches `figma`. */
export function readSelection(): SelectionPayload {
  const roots = figma.currentPage.selection;
  const nodes: SerializedNode[] = [];

  const visit = (n: SceneNode) => {
    nodes.push(serializeNode(n));
    const kids = (n as unknown as Loose).children as SceneNode[] | undefined;
    if (Array.isArray(kids)) kids.forEach(visit);
  };
  roots.forEach(visit);

  return { nodes, backdrop: roots.length > 0 ? collectBackdrop(roots[0]) : [] };
}

export function reply(res: Response): void {
  figma.ui.postMessage(res);
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/sandbox/selection.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Replace the stub dispatcher**

Rewrite `figma/src/sandbox/main.ts`:

```ts
import type { OpenMessage, Request, Tab } from "../shared/protocol";
import { readSelection, reply } from "./selection";

const TAB_FOR_COMMAND: Record<string, Tab> = {
  generate: "generate",
  audit: "audit",
  simulate: "simulate",
};

figma.showUI(__html__, { width: 420, height: 640, themeColors: true });

const open: OpenMessage = { type: "open", tab: TAB_FOR_COMMAND[figma.command] ?? "generate" };
figma.ui.postMessage(open);

figma.ui.onmessage = async (msg: Request) => {
  try {
    switch (msg.type) {
      case "read-selection": {
        const payload = readSelection();
        if (payload.nodes.length === 0) {
          reply({ id: msg.id, ok: false, reason: "no-selection", detail: "Select something on the canvas first." });
          return;
        }
        reply({ id: msg.id, ok: true, type: "selection", payload });
        return;
      }
      default:
        // Tasks 9, 10 and 13 add the remaining cases.
        reply({ id: msg.id, ok: false, reason: "figma-error", detail: `Unhandled request: ${(msg as Request).type}` });
    }
  } catch (e) {
    reply({ id: msg.id, ok: false, reason: "figma-error", detail: e instanceof Error ? e.message : String(e) });
  }
};
```

- [ ] **Step 6: Rebuild and confirm the plugin still loads**

```bash
cd figma && npm run build
```
Then in Figma desktop run any command. Expected: the panel still opens. This is a smoke check; the UI does not call `read-selection` until Task 12.

- [ ] **Step 7: Commit**

```bash
git add figma/src/sandbox/
git commit -m "feat(figma): serialize the selection and its backdrop chain

The sandbox flattens nodes, paints and ancestors into plain data and makes
no decisions. Serializers are duck-typed so they unit-test with literals
and no figma global.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 9: Write variables, with the plan-limit fallback (`sandbox/variables.ts`)

Apply a `VariableSpec[]`. Under `documentAccess: "dynamic-page"` the getters are async; `setValueForMode` is synchronous. When `addMode` hits the plan limit it throws `in addMode: Limited to N modes only`, and the fallback is a second collection.

**Files:**
- Create: `figma/src/sandbox/variables.ts`
- Modify: `figma/src/sandbox/main.ts` (add the `write-variables` and `read-written-record` cases)
- Test: `figma/src/sandbox/variables.test.ts`

**Interfaces:**
- Consumes: `VariableSpec`, `WrittenRecord`, `WriteSummary` from `../shared/protocol`; `recordFromSpecs` from `../shared/spec`.
- Produces:
  - `isModeLimitError(e: unknown): boolean`
  - `planModeStrategy(addMode: () => string): { darkModeId: string | null; needsFallback: boolean }`
  - `applySpecs(specs: VariableSpec[], record: WrittenRecord, confirmedOverwrites: string[]): Promise<WriteSummary>` (touches `figma`, not unit-tested)
  - `readWrittenRecord(): Promise<WrittenRecord | null>` (touches `figma`, not unit-tested)
  Task 11 consumes the request/response pair, not these directly.

- [ ] **Step 1: Write the failing tests**

Only the two pure helpers are unit-tested; the rest is Figma API calls covered by Task 14.

`figma/src/sandbox/variables.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isModeLimitError, planModeStrategy } from "./variables";

describe("isModeLimitError", () => {
  it("recognises the documented message", () => {
    expect(isModeLimitError(new Error("in addMode: Limited to 1 modes only"))).toBe(true);
    expect(isModeLimitError(new Error("in addMode: Limited to 4 modes only"))).toBe(true);
  });

  it("recognises it when thrown as a bare string", () => {
    expect(isModeLimitError("in addMode: Limited to 1 modes only")).toBe(true);
  });

  it("does not swallow unrelated errors", () => {
    expect(isModeLimitError(new Error("Network is unreachable"))).toBe(false);
    expect(isModeLimitError(null)).toBe(false);
  });
});

describe("planModeStrategy", () => {
  it("uses a second mode when the plan allows it", () => {
    const r = planModeStrategy(() => "mode-dark");
    expect(r).toEqual({ darkModeId: "mode-dark", needsFallback: false });
  });

  it("falls back to a second collection on the mode limit", () => {
    const r = planModeStrategy(() => { throw new Error("in addMode: Limited to 1 modes only"); });
    expect(r).toEqual({ darkModeId: null, needsFallback: true });
  });

  it("rethrows anything that is not the mode limit", () => {
    expect(() => planModeStrategy(() => { throw new Error("boom"); })).toThrow("boom");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/sandbox/variables.test.ts`
Expected: FAIL, "Failed to resolve import ./variables".

- [ ] **Step 3: Implement**

`figma/src/sandbox/variables.ts`:

```ts
import type { VariableSpec, WriteSummary, WrittenRecord } from "../shared/protocol";
import { recordFromSpecs } from "../shared/spec";

const COLLECTION = "Chart Color System";
const FALLBACK_COLLECTION = "Chart Color System Dark";
const RECORD_KEY = "chart-color-system:written";

/** Figma throws `in addMode: Limited to N modes only` when the plan caps modes. */
export function isModeLimitError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return /Limited to \d+ modes only/.test(msg);
}

/**
 * Try to add a Dark mode. On a one-mode plan this is not available, and the
 * caller writes a second collection instead. That preserves the values, not
 * the switching: a designer on a free plan rebinds to change theme. It is a
 * consolation prize, not parity, and the UI says so.
 */
export function planModeStrategy(addMode: () => string): { darkModeId: string | null; needsFallback: boolean } {
  try {
    return { darkModeId: addMode(), needsFallback: false };
  } catch (e) {
    if (isModeLimitError(e)) return { darkModeId: null, needsFallback: true };
    throw e;
  }
}

async function findCollection(name: string): Promise<VariableCollection | null> {
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  return all.find((c) => c.name === name) ?? null;
}

async function variablesOf(collection: VariableCollection): Promise<Map<string, Variable>> {
  const out = new Map<string, Variable>();
  for (const id of collection.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (v) out.set(v.name, v);
  }
  return out;
}

/** What the plugin last wrote, read back off the collection's plugin data. */
export async function readWrittenRecord(): Promise<WrittenRecord | null> {
  const collection = await findCollection(COLLECTION);
  if (!collection) return null;
  const raw = collection.getPluginData(RECORD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WrittenRecord;
  } catch {
    return null;
  }
}

function setValue(v: Variable, modeId: string, spec: VariableSpec, mode: "light" | "dark"): void {
  const value = mode === "light" ? spec.light : spec.dark;
  // setValueForMode is synchronous; there is no setValueForModeAsync.
  v.setValueForMode(modeId, value as VariableValue);
}

/**
 * Create or update the collection in place, keyed on plugin data so a re-run
 * never duplicates. `confirmedOverwrites` lists variable names the designer
 * explicitly agreed to overwrite; anything else that has drifted is left
 * exactly as the designer left it.
 */
export async function applySpecs(
  specs: VariableSpec[],
  record: WrittenRecord,
  confirmedOverwrites: string[]
): Promise<WriteSummary> {
  const confirmed = new Set(confirmedOverwrites);
  const previous = await readWrittenRecord();

  let collection = await findCollection(COLLECTION);
  let created = 0;
  let updated = 0;

  if (!collection) {
    collection = figma.variables.createVariableCollection(COLLECTION);
    collection.renameMode(collection.defaultModeId, "Light");
  }
  const lightModeId = collection.defaultModeId;

  const existingDark = collection.modes.find((m) => m.name === "Dark");
  const strategy = existingDark
    ? { darkModeId: existingDark.modeId, needsFallback: false }
    : planModeStrategy(() => collection!.addMode("Dark"));

  let fallback: VariableCollection | null = null;
  if (strategy.needsFallback) {
    fallback = (await findCollection(FALLBACK_COLLECTION)) ?? figma.variables.createVariableCollection(FALLBACK_COLLECTION);
  }

  const byName = await variablesOf(collection);
  const fallbackByName = fallback ? await variablesOf(fallback) : new Map<string, Variable>();

  for (const spec of specs) {
    const drifted =
      previous?.[spec.name] !== undefined &&
      byName.has(spec.name) &&
      !confirmed.has(spec.name) &&
      // A value the plugin wrote that no longer matches what it recorded.
      previous[spec.name].light !== record[spec.name]?.light;
    if (drifted && !confirmed.has(spec.name)) continue;

    let v = byName.get(spec.name);
    if (!v) {
      v = figma.variables.createVariable(spec.name, collection, spec.kind);
      byName.set(spec.name, v);
      created++;
    } else {
      updated++;
    }
    setValue(v, lightModeId, spec, "light");
    if (strategy.darkModeId) setValue(v, strategy.darkModeId, spec, "dark");

    if (fallback) {
      let fv = fallbackByName.get(spec.name);
      if (!fv) {
        fv = figma.variables.createVariable(spec.name, fallback, spec.kind);
        fallbackByName.set(spec.name, fv);
      }
      setValue(fv, fallback.defaultModeId, spec, "dark");
    }
  }

  collection.setPluginData(RECORD_KEY, JSON.stringify(recordFromSpecs(specs)));

  return {
    collectionId: collection.id,
    created,
    updated,
    usedFallbackCollection: Boolean(fallback),
    fallbackCollectionId: fallback?.id ?? null,
  };
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/sandbox/variables.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Wire the dispatcher cases**

In `figma/src/sandbox/main.ts`, add to the `switch`, above `default`:

```ts
      case "read-written-record": {
        const payload = await readWrittenRecord();
        reply({ id: msg.id, ok: true, type: "written-record", payload });
        return;
      }
      case "write-variables": {
        const payload = await applySpecs(msg.specs, msg.record, msg.confirmedOverwrites);
        reply({ id: msg.id, ok: true, type: "variables-written", payload });
        return;
      }
```

and add the import: `import { applySpecs, readWrittenRecord } from "./variables";`

- [ ] **Step 6: Rebuild**

Run: `cd figma && npm run build && npx vitest run`
Expected: build succeeds, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add figma/src/sandbox/variables.ts figma/src/sandbox/variables.test.ts figma/src/sandbox/main.ts
git commit -m "feat(figma): write variables in place with the plan-limit fallback

Getters are async under dynamic-page; setValueForMode is sync. On the
documented mode-limit error a second collection carries Dark, which
preserves the values and not the switching. Drifted variables are skipped
unless the designer confirmed the overwrite.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Panel persistence (`sandbox/store.ts`)

`figma.clientStorage` hangs off the `figma` global, so it lives in the sandbox and the UI reaches it by message. Persistence is a convenience and must never become a dependency.

**Files:**
- Create: `figma/src/sandbox/store.ts`
- Modify: `figma/src/sandbox/main.ts` (add `store-get` and `store-set`)
- Test: `figma/src/sandbox/store.test.ts`

**Interfaces:**
- Consumes: `PanelState` from `../shared/protocol`.
- Produces: `DEFAULT_PANEL_STATE: PanelState`, `coercePanelState(raw: unknown): PanelState`, `loadPanelState(): Promise<PanelState>`, `savePanelState(s: PanelState): Promise<void>`.
  Task 11 consumes `DEFAULT_PANEL_STATE` through the protocol.

- [ ] **Step 1: Write the failing tests**

`figma/src/sandbox/store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { coercePanelState, DEFAULT_PANEL_STATE } from "./store";

describe("coercePanelState", () => {
  it("returns defaults for null, undefined and junk", () => {
    expect(coercePanelState(null)).toEqual(DEFAULT_PANEL_STATE);
    expect(coercePanelState(undefined)).toEqual(DEFAULT_PANEL_STATE);
    expect(coercePanelState("nonsense")).toEqual(DEFAULT_PANEL_STATE);
    expect(coercePanelState(42)).toEqual(DEFAULT_PANEL_STATE);
  });

  it("keeps valid fields and replaces invalid ones", () => {
    const s = coercePanelState({ tab: "audit", n: 7, posture: "kpi", sequentialSteps: 5, divergingSteps: 9, explicitBackground: "#ffffff" });
    expect(s).toEqual({ tab: "audit", n: 7, posture: "kpi", sequentialSteps: 5, divergingSteps: 9, explicitBackground: "#ffffff" });
  });

  it("rejects an out-of-range n and an unknown posture", () => {
    const s = coercePanelState({ n: 999, posture: "wild", tab: "nope" });
    expect(s.n).toBe(DEFAULT_PANEL_STATE.n);
    expect(s.posture).toBe(DEFAULT_PANEL_STATE.posture);
    expect(s.tab).toBe(DEFAULT_PANEL_STATE.tab);
  });

  it("rejects a background that is not a hex string", () => {
    expect(coercePanelState({ explicitBackground: "puce" }).explicitBackground).toBeNull();
    expect(coercePanelState({ explicitBackground: "#abc123" }).explicitBackground).toBe("#abc123");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/sandbox/store.test.ts`
Expected: FAIL, "Failed to resolve import ./store".

- [ ] **Step 3: Implement**

`figma/src/sandbox/store.ts`:

```ts
import { MAX_SLOTS } from "@engine/encoding";
import type { PanelState, Tab } from "../shared/protocol";

const KEY = "panel-state";

export const DEFAULT_PANEL_STATE: PanelState = {
  tab: "generate",
  n: 6,
  posture: "comparative",
  sequentialSteps: 7,
  divergingSteps: 9,
  explicitBackground: null,
};

const TABS: Tab[] = ["generate", "audit", "simulate"];
const POSTURES = ["kpi", "comparative", "exploratory"] as const;

/** Stored state is untrusted: it may predate a schema change or be hand-edited. */
export function coercePanelState(raw: unknown): PanelState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PANEL_STATE };
  const q = raw as Record<string, unknown>;
  const int = (v: unknown, lo: number, hi: number, fallback: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback;

  return {
    tab: TABS.includes(q.tab as Tab) ? (q.tab as Tab) : DEFAULT_PANEL_STATE.tab,
    n: int(q.n, 1, MAX_SLOTS, DEFAULT_PANEL_STATE.n),
    posture: (POSTURES as readonly string[]).includes(q.posture as string)
      ? (q.posture as PanelState["posture"])
      : DEFAULT_PANEL_STATE.posture,
    sequentialSteps: int(q.sequentialSteps, 2, 11, DEFAULT_PANEL_STATE.sequentialSteps),
    divergingSteps: int(q.divergingSteps, 3, 11, DEFAULT_PANEL_STATE.divergingSteps),
    explicitBackground:
      typeof q.explicitBackground === "string" && /^#[0-9a-fA-F]{6}$/.test(q.explicitBackground)
        ? q.explicitBackground
        : null,
  };
}

export async function loadPanelState(): Promise<PanelState> {
  try {
    return coercePanelState(await figma.clientStorage.getAsync(KEY));
  } catch {
    // Persistence is a convenience, never a dependency.
    return { ...DEFAULT_PANEL_STATE };
  }
}

export async function savePanelState(s: PanelState): Promise<void> {
  try {
    await figma.clientStorage.setAsync(KEY, s);
  } catch {
    // Silent: failing to remember a slider position is not worth an error.
  }
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/sandbox/store.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Wire the dispatcher cases**

In `figma/src/sandbox/main.ts`, add above `default`:

```ts
      case "store-get": {
        reply({ id: msg.id, ok: true, type: "store", payload: await loadPanelState() });
        return;
      }
      case "store-set": {
        await savePanelState(msg.state);
        reply({ id: msg.id, ok: true, type: "stored" });
        return;
      }
```

and the import: `import { loadPanelState, savePanelState } from "./store";`

- [ ] **Step 6: Commit**

```bash
git add figma/src/sandbox/store.ts figma/src/sandbox/store.test.ts figma/src/sandbox/main.ts
git commit -m "feat(figma): remember panel state in clientStorage

clientStorage hangs off the figma global so it lives sandbox-side and the UI
reaches it by message. Stored state is coerced on read, and any failure
falls back to defaults: remembering a slider position is never worth an
error.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 11: UI bridge and shell (`ui/bridge.ts`, `ui/App.tsx`)

A correlated request/response bridge over `postMessage`, plus the three-tab shell whose state survives relaunch. State is shared across tabs so a designer can audit a selection and then generate a palette that fixes it without relaunching.

**Files:**
- Create: `figma/src/ui/bridge.ts`, `figma/src/ui/state.ts`
- Modify: `figma/src/ui/App.tsx`
- Test: `figma/src/ui/bridge.test.ts`

**Interfaces:**
- Consumes: `Request`, `Response`, `PanelState`, `Tab`, `isFailure` from `../shared/protocol`.
- Produces:
  - `send(req: Omit<Request, "id">): Promise<Response>`
  - `__handleMessage(data: unknown): void` (exported only so the test can drive the bridge without a real iframe)
  - `usePanelState(): { state: PanelState; set: (patch: Partial<PanelState>) => void; ready: boolean }`
  Tasks 12, 13, and 14 consume `send` and `usePanelState`.

- [ ] **Step 1: Write the failing tests**

`figma/src/ui/bridge.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { send, __handleMessage } from "./bridge";

beforeEach(() => {
  (globalThis as any).parent = { postMessage: vi.fn() };
});

describe("send", () => {
  it("posts a request carrying a unique id and resolves on the matching reply", async () => {
    const p = send({ type: "read-selection" });
    const posted = (globalThis as any).parent.postMessage.mock.calls[0][0].pluginMessage;
    expect(posted.type).toBe("read-selection");
    expect(typeof posted.id).toBe("string");

    __handleMessage({ pluginMessage: { id: posted.id, ok: true, type: "selection", payload: { nodes: [], backdrop: [] } } });
    await expect(p).resolves.toMatchObject({ ok: true, type: "selection" });
  });

  it("ignores a reply whose id does not match", async () => {
    const p = send({ type: "store-get" });
    const posted = (globalThis as any).parent.postMessage.mock.calls[0][0].pluginMessage;

    __handleMessage({ pluginMessage: { id: "someone-else", ok: true, type: "stored" } });
    const settled = await Promise.race([p.then(() => "resolved"), Promise.resolve("pending")]);
    expect(settled).toBe("pending");

    __handleMessage({ pluginMessage: { id: posted.id, ok: true, type: "stored" } });
    await expect(p).resolves.toMatchObject({ ok: true });
  });

  it("resolves rather than rejects on a failure reply, so callers handle it explicitly", async () => {
    const p = send({ type: "read-selection" });
    const posted = (globalThis as any).parent.postMessage.mock.calls[0][0].pluginMessage;
    __handleMessage({ pluginMessage: { id: posted.id, ok: false, reason: "no-selection", detail: "Select something first." } });
    const res = await p;
    expect(res.ok).toBe(false);
  });

  it("gives every request a distinct id", async () => {
    send({ type: "store-get" });
    send({ type: "store-get" });
    const calls = (globalThis as any).parent.postMessage.mock.calls;
    expect(calls[0][0].pluginMessage.id).not.toBe(calls[1][0].pluginMessage.id);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/ui/bridge.test.ts`
Expected: FAIL, "Failed to resolve import ./bridge".

- [ ] **Step 3: Implement the bridge**

`figma/src/ui/bridge.ts`:

```ts
import type { Request, Response } from "../shared/protocol";

let seq = 0;
const pending = new Map<string, (r: Response) => void>();

/**
 * Exported for tests: drives the bridge without a real iframe. Production
 * wiring is the window listener registered below.
 */
export function __handleMessage(data: unknown): void {
  const msg = (data as { pluginMessage?: Response })?.pluginMessage;
  if (!msg || typeof msg.id !== "string") return;
  const resolve = pending.get(msg.id);
  if (!resolve) return; // not ours, or already settled
  pending.delete(msg.id);
  resolve(msg);
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (e: MessageEvent) => __handleMessage(e.data));
}

/**
 * A failure reply resolves rather than rejects, so every caller has to handle
 * it explicitly instead of letting a catch-all swallow the reason.
 */
export function send(req: Omit<Request, "id">): Promise<Response> {
  const id = `r${++seq}-${Date.now()}`;
  return new Promise<Response>((resolve) => {
    pending.set(id, resolve);
    parent.postMessage({ pluginMessage: { ...req, id } }, "*");
  });
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/ui/bridge.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Implement the shared panel state hook**

`figma/src/ui/state.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { PanelState } from "../shared/protocol";
import { send } from "./bridge";

const FALLBACK: PanelState = {
  tab: "generate",
  n: 6,
  posture: "comparative",
  sequentialSteps: 7,
  divergingSteps: 9,
  explicitBackground: null,
};

export function usePanelState() {
  const [state, setState] = useState<PanelState>(FALLBACK);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    send({ type: "store-get" }).then((r) => {
      if (cancelled) return;
      if (r.ok && r.type === "store" && r.payload) setState(r.payload);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const set = useCallback((patch: Partial<PanelState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => { void send({ type: "store-set", state: next }); }, 300);
      return next;
    });
  }, []);

  return { state, set, ready };
}
```

- [ ] **Step 6: Replace the shell**

`figma/src/ui/App.tsx`:

```tsx
import { useEffect } from "react";
import type { OpenMessage, Tab } from "../shared/protocol";
import { usePanelState } from "./state";
import { GenerateTab } from "./GenerateTab";
import { AuditTab } from "./AuditTab";
import { SimulateTab } from "./SimulateTab";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "generate", label: "Generate" },
  { id: "audit", label: "Audit" },
  { id: "simulate", label: "Simulate" },
];

export function App() {
  const { state, set, ready } = usePanelState();

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage as OpenMessage | undefined;
      if (msg?.type === "open") set({ tab: msg.tab });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [set]);

  if (!ready) return <main style={S.main}>Loading.</main>;

  return (
    <main style={S.main}>
      <nav style={S.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => set({ tab: t.id })}
            style={{ ...S.tab, ...(state.tab === t.id ? S.tabActive : null) }}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {state.tab === "generate" && <GenerateTab state={state} set={set} />}
      {state.tab === "audit" && <AuditTab state={state} set={set} />}
      {state.tab === "simulate" && <SimulateTab />}
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 12, padding: 12, color: "var(--figma-color-text)" },
  tabs: { display: "flex", gap: 4, marginBottom: 12 },
  tab: { flex: 1, padding: "6px 8px", fontSize: 12, cursor: "pointer", border: "1px solid var(--figma-color-border)", background: "transparent", color: "inherit", borderRadius: 4 },
  tabActive: { background: "var(--figma-color-bg-brand)", color: "var(--figma-color-text-onbrand)" },
};
```

- [ ] **Step 7: Commit**

Note the build will not succeed until Tasks 12 through 14 create the three tab components. Commit the bridge and state now; the shell compiles at the end of Task 14.

```bash
git add figma/src/ui/bridge.ts figma/src/ui/bridge.test.ts figma/src/ui/state.ts figma/src/ui/App.tsx
git commit -m "feat(figma): correlated message bridge and three-tab shell

Failure replies resolve rather than reject so every caller handles the
reason explicitly. Panel state is shared across tabs and debounced into
clientStorage.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Generate tab

Solve a palette against the designer's actual background, show the audit before writing anything, and require confirmation for any variable that has drifted since the plugin last wrote it.

Plan 1 has no chart kinds, so posture is a direct control and N is capped at `min(MAX_SLOTS, POSTURE[posture].maxCategorical)`. `safeMaxN` is proprietary and unavailable here; the live `auditPalette` verdict is what tells the designer whether the chosen N actually holds.

**Files:**
- Create: `figma/src/shared/defaults.ts`, `figma/src/ui/GenerateTab.tsx`
- Test: `figma/src/shared/defaults.test.ts`

**Interfaces:**
- Consumes: `solveCategorical` from `@engine/palette/categorical`; `sequentialRamp`, `divergingRamp` from `@engine/palette/ramps`; `auditPalette` from `@engine/audit`; `POSTURE` from `@engine/constraints`; `MAX_SLOTS` from `@engine/encoding`; `fromCss` from `@engine/palette/distance`; `buildVariableSpec`, `recordFromSpecs`, `diffWritten` from `../shared/spec`; `resolveBackground`, `BACKGROUND_REFUSAL_COPY` from `../shared/background`; `send` from `./bridge`.
- Produces: `DEFAULT_TOKENS` from `../shared/defaults`, and the `GenerateTab` component. Task 13 reuses `DEFAULT_TOKENS.light.surface` as its fallback background label.

- [ ] **Step 1: Write the failing test for the defaults**

The plugin needs chrome tokens (surface, grid, axis, label) and ramp endpoints. **These are the plugin's own neutral values, deliberately not copied from `src/index.css`**, which is proprietary and ships no CSS to consumers.

`figma/src/shared/defaults.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { contrastRatio } from "@engine/audit";
import { DEFAULT_TOKENS } from "./defaults";

describe("DEFAULT_TOKENS", () => {
  it("has a light and a dark set with the same keys", () => {
    expect(Object.keys(DEFAULT_TOKENS.light).sort()).toEqual(Object.keys(DEFAULT_TOKENS.dark).sort());
  });

  it("keeps label text legible on its own surface in both themes", () => {
    for (const theme of ["light", "dark"] as const) {
      const t = DEFAULT_TOKENS[theme];
      expect(contrastRatio(t.label, t.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps grid and axis at or above the 3:1 non-text floor", () => {
    for (const theme of ["light", "dark"] as const) {
      const t = DEFAULT_TOKENS[theme];
      expect(contrastRatio(t.grid, t.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.axis, t.surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it("orients the light surface lighter than the dark surface", () => {
    expect(DEFAULT_TOKENS.light.surface.oklab.l).toBeGreaterThan(DEFAULT_TOKENS.dark.surface.oklab.l);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/shared/defaults.test.ts`
Expected: FAIL, "Failed to resolve import ./defaults".

- [ ] **Step 3: Implement the defaults**

`figma/src/shared/defaults.ts`:

```ts
import { fromCss, type ColorRecord } from "@engine/palette/distance";

export interface ChromeTokens {
  surface: ColorRecord;
  grid: ColorRecord;
  axis: ColorRecord;
  label: ColorRecord;
  seqLow: ColorRecord;
  seqHigh: ColorRecord;
  divNeg: ColorRecord;
  divMid: ColorRecord;
  divPos: ColorRecord;
}

/**
 * The plugin's own neutral chrome. Deliberately NOT copied from
 * `src/index.css`, which is proprietary and ships no CSS to consumers. These
 * values exist so the plugin stands on its own; a designer overrides the
 * background from the canvas anyway.
 *
 * The accompanying test enforces 4.5:1 for label text and 3:1 for grid and
 * axis against their own surface, so edits here cannot quietly go illegible.
 */
export const DEFAULT_TOKENS: { light: ChromeTokens; dark: ChromeTokens } = {
  light: {
    surface: fromCss("#ffffff"),
    grid: fromCss("#9aa0a6"),
    axis: fromCss("#6b7178"),
    label: fromCss("#31363b"),
    seqLow: fromCss("#e8eef7"),
    seqHigh: fromCss("#1b3f6b"),
    divNeg: fromCss("#8a3324"),
    divMid: fromCss("#f2efe9"),
    divPos: fromCss("#1f4d3f"),
  },
  dark: {
    surface: fromCss("#14171a"),
    grid: fromCss("#6d757d"),
    axis: fromCss("#8b949c"),
    label: fromCss("#e6e9ec"),
    seqLow: fromCss("#16233a"),
    seqHigh: fromCss("#a8c6ea"),
    divNeg: fromCss("#e08b7c"),
    divMid: fromCss("#2a2d31"),
    divPos: fromCss("#7fc0aa"),
  },
};
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/shared/defaults.test.ts`
Expected: PASS, 4 tests. If a contrast assertion fails, adjust the hex values until it passes. Do not weaken the assertion.

- [ ] **Step 5: Implement the Generate tab**

`figma/src/ui/GenerateTab.tsx`:

```tsx
import { useMemo, useState } from "react";
import { solveCategorical } from "@engine/palette/categorical";
import { sequentialRamp, divergingRamp } from "@engine/palette/ramps";
import { auditPalette } from "@engine/audit";
import { POSTURE, type Posture } from "@engine/constraints";
import { MAX_SLOTS } from "@engine/encoding";
import { fromCss } from "@engine/palette/distance";
import type { PanelState } from "../shared/protocol";
import { DEFAULT_TOKENS } from "../shared/defaults";
import { buildVariableSpec, recordFromSpecs, diffWritten, type Drift } from "../shared/spec";
import { resolveBackground, BACKGROUND_REFUSAL_COPY } from "../shared/background";
import { send } from "./bridge";

type Props = { state: PanelState; set: (p: Partial<PanelState>) => void };

export function GenerateTab({ state, set }: Props) {
  const [bgNote, setBgNote] = useState<string | null>(null);
  const [drift, setDrift] = useState<Drift[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cap = Math.min(MAX_SLOTS, POSTURE[state.posture].maxCategorical);
  const n = Math.min(state.n, cap);

  const lightBg = state.explicitBackground ? fromCss(state.explicitBackground) : DEFAULT_TOKENS.light.surface;

  const solved = useMemo(() => {
    const light = solveCategorical({ n, posture: state.posture, background: lightBg, grid: DEFAULT_TOKENS.light.grid, locks: [] });
    const dark = solveCategorical({ n, posture: state.posture, background: DEFAULT_TOKENS.dark.surface, grid: DEFAULT_TOKENS.dark.grid, locks: [] });
    return { light, dark };
  }, [n, state.posture, lightBg]);

  const audit = useMemo(() => auditPalette(solved.light.palette, lightBg), [solved, lightBg]);

  /** Pull the designer's real background off the canvas, or say why we cannot. */
  async function useCanvasBackground() {
    const res = await send({ type: "read-selection" });
    if (!res.ok) { setBgNote(res.detail); return; }
    if (res.type !== "selection") return;
    const r = resolveBackground(res.payload.backdrop);
    if (!r.ok) { setBgNote(BACKGROUND_REFUSAL_COPY[r.reason]); return; }
    set({ explicitBackground: r.color.hex });
    setBgNote(null);
  }

  async function write(confirmedOverwrites: string[] = []) {
    setBusy(true);
    try {
      const specs = buildVariableSpec({
        light: { palette: solved.light.palette, ...DEFAULT_TOKENS.light, sequential: sequentialRamp(DEFAULT_TOKENS.light.seqLow, DEFAULT_TOKENS.light.seqHigh, state.sequentialSteps), diverging: divergingRamp(DEFAULT_TOKENS.light.divNeg, DEFAULT_TOKENS.light.divMid, DEFAULT_TOKENS.light.divPos, state.divergingSteps) },
        dark: { palette: solved.dark.palette, ...DEFAULT_TOKENS.dark, sequential: sequentialRamp(DEFAULT_TOKENS.dark.seqLow, DEFAULT_TOKENS.dark.seqHigh, state.sequentialSteps), diverging: divergingRamp(DEFAULT_TOKENS.dark.divNeg, DEFAULT_TOKENS.dark.divMid, DEFAULT_TOKENS.dark.divPos, state.divergingSteps) },
      });
      const record = recordFromSpecs(specs);

      if (confirmedOverwrites.length === 0) {
        const prev = await send({ type: "read-written-record" });
        if (prev.ok && prev.type === "written-record" && prev.payload) {
          const d = diffWritten(prev.payload, record);
          if (d.length > 0) { setDrift(d); setBusy(false); return; }
        }
      }

      const res = await send({ type: "write-variables", specs, record, confirmedOverwrites });
      if (!res.ok) { setSummary(res.detail); return; }
      if (res.type !== "variables-written") return;
      const p = res.payload;
      setSummary(
        `${p.created} created, ${p.updated} updated.` +
        (p.usedFallbackCollection
          ? " Your plan allows one mode per collection, so Dark went into a second collection. That keeps both sets of values, but switching theme means rebinding."
          : "")
      );
      setDrift(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <label style={S.row}>
        Posture
        <select value={state.posture} onChange={(e) => set({ posture: e.target.value as Posture })}>
          {(Object.keys(POSTURE) as Posture[]).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>

      <label style={S.row}>
        Series ({n} of {cap} max)
        <input type="range" min={1} max={cap} value={n} onChange={(e) => set({ n: Number(e.target.value) })} />
      </label>

      <div style={S.row}>
        <span>Background {state.explicitBackground ?? "default white"}</span>
        <button onClick={useCanvasBackground}>Use canvas</button>
      </div>
      {bgNote && <p style={S.warn}>{bgNote}</p>}

      <div style={S.swatches}>
        {solved.light.palette.map((c, i) => (
          <span key={i} title={c.hex} style={{ ...S.swatch, background: c.hex }} />
        ))}
      </div>

      <p style={audit.overall === "pass" ? S.ok : S.warn}>
        Audit {audit.overall}. Worst contrast against the background {audit.worstContrastVsBg.toFixed(2)} to 1.
        {solved.light.relaxations.length > 0 && ` Relaxed: ${solved.light.relaxations.join(", ")}.`}
      </p>

      {drift && (
        <div style={S.warn}>
          <p>{drift.length} variable(s) changed since this plugin last wrote them. Your edits are kept unless you overwrite them.</p>
          <ul>{drift.map((d) => <li key={`${d.name}:${d.mode}`}>{d.name} ({d.mode}): yours {d.current}, plugin {d.recorded}</li>)}</ul>
          <button onClick={() => write(drift.map((d) => d.name))} disabled={busy}>Overwrite these</button>
          <button onClick={() => setDrift(null)} disabled={busy}>Keep mine</button>
        </div>
      )}

      <button onClick={() => write()} disabled={busy} style={S.primary}>Write variables</button>
      {summary && <p style={S.ok}>{summary}</p>}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 },
  swatches: { display: "flex", flexWrap: "wrap", gap: 4, margin: "8px 0" },
  swatch: { width: 22, height: 22, borderRadius: 3, border: "1px solid var(--figma-color-border)" },
  ok: { color: "var(--figma-color-text-success)" },
  warn: { color: "var(--figma-color-text-warning)" },
  primary: { width: "100%", padding: 8, marginTop: 8, cursor: "pointer" },
};
```

- [ ] **Step 6: Commit**

```bash
git add figma/src/shared/defaults.ts figma/src/shared/defaults.test.ts figma/src/ui/GenerateTab.tsx
git commit -m "feat(figma): Generate tab solving against the designer's background

Plugin-owned neutral chrome tokens, deliberately not copied from the
proprietary index.css, with contrast floors enforced by test. Posture is a
direct control in Plan 1 because chart kinds are Plan 2, and the live audit
verdict is what tells the designer whether the chosen N holds. Drifted
variables require explicit confirmation before being overwritten.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 13: Audit tab

Audit the colors already in a file against the selection's real backdrop. The refusal set is deliberately wide: this plugin makes accessibility claims to strangers under the author's name, and a wrong green pass is worse than no plugin.

**Files:**
- Create: `figma/src/ui/AuditTab.tsx`, `figma/src/shared/auditRun.ts`
- Test: `figma/src/shared/auditRun.test.ts`

**Interfaces:**
- Consumes: `extractFills`, `ExtractedFill`, `SkipReason` from `./fills`; `resolveBackground`, `BACKGROUND_REFUSAL_COPY` from `./background`; `compositeOver` from `./color`; `auditPalette`, `contrastRatio` from `@engine/audit`; `SelectionPayload` from `./protocol`.
- Produces:
  - `interface AuditRun { background: ColorRecord | null; backgroundNote: string | null; audited: Array<{ fill: ExtractedFill; composited: ColorRecord; contrast: number }>; skipped: ExtractedFill[]; report: AuditReport | null }`
  - `runAudit(payload: SelectionPayload, explicitBackground: ColorRecord | null): AuditRun`
  - `SKIP_REASON_COPY: Record<SkipReason, string>`
  Only the `AuditTab` component consumes these.

- [ ] **Step 1: Write the failing tests**

`figma/src/shared/auditRun.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fromCss } from "@engine/palette/distance";
import { runAudit, SKIP_REASON_COPY } from "./auditRun";
import type { SelectionPayload, SerializedPaint } from "./protocol";

const solid = (r: number, g: number, b: number, o = 1): SerializedPaint => ({
  kind: "solid", visible: true, opacity: o, blendMode: "NORMAL", color: { r, g, b },
});
const payload = (over: Partial<SelectionPayload> = {}): SelectionPayload => ({
  nodes: [{ id: "n1", name: "Bar", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [solid(0, 0, 0)] }],
  backdrop: [{ nodeId: "f1", nodeName: "Frame", opacity: 1, blendMode: "NORMAL", fills: [solid(1, 1, 1)] }],
  ...over,
});

describe("runAudit", () => {
  it("uses the resolved backdrop and reports contrast against it", () => {
    const r = runAudit(payload(), null);
    expect(r.background!.hex).toBe("#ffffff");
    expect(r.audited).toHaveLength(1);
    expect(r.audited[0].contrast).toBeGreaterThan(20); // black on white
    expect(r.backgroundNote).toBeNull();
  });

  it("prefers an explicit background over the canvas", () => {
    const r = runAudit(payload(), fromCss("#808080"));
    expect(r.background!.hex).toBe("#808080");
  });

  it("refuses with a note when the backdrop cannot be resolved and none was given", () => {
    const img: SerializedPaint = { kind: "image", visible: true, opacity: 1, blendMode: "NORMAL" };
    const r = runAudit(payload({ backdrop: [{ nodeId: "f1", nodeName: "F", opacity: 1, blendMode: "NORMAL", fills: [img] }] }), null);
    expect(r.background).toBeNull();
    expect(r.backgroundNote).toContain("image");
    expect(r.audited).toEqual([]);
    expect(r.report).toBeNull();
  });

  it("composites a translucent fill against the background before auditing", () => {
    const r = runAudit(payload({
      nodes: [{ id: "n1", name: "Bar", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [solid(0, 0, 0, 0.5)] }],
    }), null);
    expect(Math.abs(r.audited[0].composited.rgb.r - 0.5)).toBeLessThan(1e-6);
  });

  it("separates skipped fills and keeps their reasons", () => {
    const img: SerializedPaint = { kind: "image", visible: true, opacity: 1, blendMode: "NORMAL" };
    const r = runAudit(payload({
      nodes: [
        { id: "n1", name: "Bar", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [solid(0, 0, 0)] },
        { id: "n2", name: "Photo", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [img] },
      ],
    }), null);
    expect(r.audited).toHaveLength(1);
    expect(r.skipped.map((s) => s.reason)).toEqual(["image-fill"]);
  });

  it("returns a pairwise report when two or more fills are auditable", () => {
    const r = runAudit(payload({
      nodes: [
        { id: "n1", name: "A", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [solid(0, 0, 0)] },
        { id: "n2", name: "B", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [solid(0, 0, 0.02)] },
      ],
    }), null);
    expect(r.report).not.toBeNull();
    expect(["pass", "warn", "fail"]).toContain(r.report!.overall);
  });

  it("has copy for every skip reason, with no em dashes", () => {
    for (const [, copy] of Object.entries(SKIP_REASON_COPY)) {
      expect(copy).toBeTruthy();
      expect(copy).not.toContain("\u2014");
    }
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/shared/auditRun.test.ts`
Expected: FAIL, "Failed to resolve import ./auditRun".

- [ ] **Step 3: Implement**

`figma/src/shared/auditRun.ts`:

```ts
import { auditPalette, contrastRatio, type AuditReport } from "@engine/audit";
import type { ColorRecord } from "@engine/palette/distance";
import { compositeOver } from "./color";
import { extractFills, type ExtractedFill, type SkipReason } from "./fills";
import { resolveBackground, BACKGROUND_REFUSAL_COPY } from "./background";
import type { SelectionPayload } from "./protocol";

export const SKIP_REASON_COPY: Record<SkipReason, string> = {
  hidden: "The paint is hidden, so it is not on screen to audit.",
  "mixed-fills": "This node has mixed fills, so there is no single colour to measure.",
  "no-fills": "This node has no fill at all.",
  "image-fill": "This is an image fill. Contrast against a photograph is not a number this tool can defend.",
  "video-fill": "This is a video fill, and its colour changes frame to frame.",
  "unknown-fill": "Figma reported a paint type this plugin does not recognise.",
  "non-normal-blend": "A blend mode other than Normal is in play, which changes the colour that reaches the eye.",
};

export interface AuditRun {
  background: ColorRecord | null;
  backgroundNote: string | null;
  audited: Array<{ fill: ExtractedFill; composited: ColorRecord; contrast: number }>;
  skipped: ExtractedFill[];
  report: AuditReport | null;
}

/**
 * An explicit background always wins. Otherwise the backdrop is resolved from
 * the selection's ancestors, and if that refuses the audit does not run: a
 * number measured against a guessed background is a false claim.
 */
export function runAudit(payload: SelectionPayload, explicitBackground: ColorRecord | null): AuditRun {
  let background = explicitBackground;
  let backgroundNote: string | null = null;

  if (!background) {
    const r = resolveBackground(payload.backdrop);
    if (r.ok) background = r.color;
    else backgroundNote = BACKGROUND_REFUSAL_COPY[r.reason];
  }

  const all = extractFills(payload.nodes);
  const skipped = all.filter((f) => f.status === "skipped");

  if (!background) return { background: null, backgroundNote, audited: [], skipped, report: null };

  const audited = all
    .filter((f) => f.status === "auditable" && f.color)
    .map((f) => {
      const composited = compositeOver(f.color!, f.alpha ?? 1, background!);
      return { fill: f, composited, contrast: contrastRatio(composited, background!) };
    });

  const report = audited.length >= 2 ? auditPalette(audited.map((a) => a.composited), background) : null;

  return { background, backgroundNote, audited, skipped, report };
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/shared/auditRun.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Implement the tab**

`figma/src/ui/AuditTab.tsx`:

```tsx
import { useState } from "react";
import { fromCss } from "@engine/palette/distance";
import type { PanelState } from "../shared/protocol";
import { runAudit, SKIP_REASON_COPY, type AuditRun } from "../shared/auditRun";
import { send } from "./bridge";

type Props = { state: PanelState; set: (p: Partial<PanelState>) => void };

export function AuditTab({ state }: Props) {
  const [run, setRun] = useState<AuditRun | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function audit() {
    setNote(null);
    const res = await send({ type: "read-selection" });
    if (!res.ok) { setNote(res.detail); setRun(null); return; }
    if (res.type !== "selection") return;
    const explicit = state.explicitBackground ? fromCss(state.explicitBackground) : null;
    setRun(runAudit(res.payload, explicit));
  }

  return (
    <section>
      <button onClick={audit} style={S.primary}>Audit selection</button>
      {note && <p style={S.warn}>{note}</p>}
      {!run && !note && <p style={S.muted}>Select frames or shapes on the canvas, then audit.</p>}

      {run?.backgroundNote && <p style={S.warn}>{run.backgroundNote} Set a background on the Generate tab to audit anyway.</p>}

      {run?.report && (
        <p style={run.report.overall === "pass" ? S.ok : S.warn}>
          Overall {run.report.overall}. Worst contrast against the background {run.report.worstContrastVsBg.toFixed(2)} to 1.
        </p>
      )}

      {run && run.audited.length > 0 && (
        <table style={S.table}>
          <caption style={S.caption}>Audited fills and their contrast against the resolved background</caption>
          <thead>
            <tr><th scope="col">Layer</th><th scope="col">Colour</th><th scope="col">Contrast</th></tr>
          </thead>
          <tbody>
            {run.audited.map((a, i) => (
              <tr key={i}>
                <td>{a.fill.nodeName}{a.fill.source === "gradient-stop" ? ` (stop ${a.fill.stopIndex! + 1})` : ""}</td>
                <td><span style={{ ...S.chip, background: a.composited.hex }} /> {a.composited.hex}</td>
                <td>{a.contrast.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {run && run.skipped.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary>{run.skipped.length} not audited</summary>
          <ul>
            {run.skipped.map((s, i) => <li key={i}>{s.nodeName}: {SKIP_REASON_COPY[s.reason!]}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  primary: { width: "100%", padding: 8, cursor: "pointer" },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 11 },
  caption: { captionSide: "top", textAlign: "left", paddingBottom: 4, opacity: 0.7 },
  chip: { display: "inline-block", width: 10, height: 10, borderRadius: 2, marginRight: 4 },
  ok: { color: "var(--figma-color-text-success)" },
  warn: { color: "var(--figma-color-text-warning)" },
  muted: { opacity: 0.7 },
};
```

- [ ] **Step 6: Commit**

```bash
git add figma/src/shared/auditRun.ts figma/src/shared/auditRun.test.ts figma/src/ui/AuditTab.tsx
git commit -m "feat(figma): Audit tab measuring against the selection's real backdrop

Refuses rather than guessing when the backdrop is an image, a gradient, a
non-normal blend, or see-through to canvas. Skipped fills are listed with
their reason, so the panel never reports '0 results'. A wrong green pass is
worse than no plugin.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Simulate tab and canvas rendering

Clone the selected frames, rewrite every resolved fill through `simulateRgb` for deutan, protan, tritan, and achromatopsia, and lay the results out beside the original. Originals are never mutated.

**Files:**
- Create: `figma/src/shared/simulation.ts`, `figma/src/sandbox/simulate.ts`, `figma/src/ui/SimulateTab.tsx`
- Modify: `figma/src/sandbox/main.ts` (add `render-simulation`)
- Test: `figma/src/shared/simulation.test.ts`

**Interfaces:**
- Consumes: `simulateRgb`, `CVD_TYPES` from `@engine/palette/cvd`; `simulateColor` from `@engine/audit`; `fromFigmaRgb`, `toFigmaRgb` from `./color`; `SelectionPayload`, `SimulationFrameSpec` from `./protocol`.
- Produces:
  - `SIM_MODES: Array<"deutan" | "protan" | "tritan" | "achromatopsia">`
  - `buildSimulationFrames(payload: SelectionPayload, width: number): SimulationFrameSpec[]`
  - `renderSimulation(frames: SimulationFrameSpec[]): string[]` (touches `figma`, not unit-tested)

- [ ] **Step 1: Write the failing tests**

`figma/src/shared/simulation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSimulationFrames, SIM_MODES } from "./simulation";
import type { SelectionPayload, SerializedPaint } from "./protocol";

const solid = (r: number, g: number, b: number): SerializedPaint => ({
  kind: "solid", visible: true, opacity: 1, blendMode: "NORMAL", color: { r, g, b },
});
const payload: SelectionPayload = {
  nodes: [
    { id: "n1", name: "Bar A", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [solid(1, 0, 0)] },
    { id: "n2", name: "Bar B", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [solid(0, 1, 0)] },
  ],
  backdrop: [],
};

describe("buildSimulationFrames", () => {
  const frames = buildSimulationFrames(payload, 400);

  it("produces one frame per simulated vision mode", () => {
    expect(frames).toHaveLength(SIM_MODES.length);
    expect(frames.map((f) => f.label)).toEqual(SIM_MODES.map((m) => expect.stringContaining(m)) as unknown as string[]);
  });

  it("offsets each frame so they sit side by side", () => {
    const offsets = frames.map((f) => f.offsetX);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(new Set(offsets).size).toBe(offsets.length);
  });

  it("carries a replacement for every solid fill of every node", () => {
    for (const f of frames) expect(f.replacements).toHaveLength(2);
  });

  it("actually changes red under deutan", () => {
    const deutan = frames.find((f) => f.label.includes("deutan"))!;
    const red = deutan.replacements.find((r) => r.nodeId === "n1")!;
    expect(red.color).not.toEqual({ r: 1, g: 0, b: 0 });
  });

  it("makes achromatopsia produce equal channels", () => {
    const gray = frames.find((f) => f.label.includes("achromatopsia"))!;
    const c = gray.replacements[0].color;
    expect(Math.abs(c.r - c.g)).toBeLessThan(1e-3);
    expect(Math.abs(c.g - c.b)).toBeLessThan(1e-3);
  });

  it("skips fills it cannot simulate rather than emitting a wrong colour", () => {
    const img: SerializedPaint = { kind: "image", visible: true, opacity: 1, blendMode: "NORMAL" };
    const withImage = buildSimulationFrames({
      nodes: [{ id: "n3", name: "Photo", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [img] }],
      backdrop: [],
    }, 400);
    expect(withImage[0].replacements).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd figma && npx vitest run src/shared/simulation.test.ts`
Expected: FAIL, "Failed to resolve import ./simulation".

- [ ] **Step 3: Implement the pure builder**

`figma/src/shared/simulation.ts`:

```ts
import { simulateColor, type VisionMode } from "@engine/audit";
import { fromFigmaRgb, toFigmaRgb } from "./color";
import type { SelectionPayload, SimulationFrameSpec } from "./protocol";

export const SIM_MODES: VisionMode[] = ["deutan", "protan", "tritan", "achromatopsia"];

const GAP = 40;

/**
 * One frame per vision mode, each carrying the replacement colour for every
 * solid fill in the selection, addressed by original node id and fill index.
 * Image, gradient and video fills get no replacement: the sandbox leaves them
 * exactly as they are rather than inventing a colour for them.
 */
export function buildSimulationFrames(payload: SelectionPayload, width: number): SimulationFrameSpec[] {
  return SIM_MODES.map((mode, i) => {
    const replacements: SimulationFrameSpec["replacements"] = [];
    for (const node of payload.nodes) {
      if (node.fills === "mixed") continue;
      node.fills.forEach((paint, fillIndex) => {
        if (paint.kind !== "solid" || !paint.color) return;
        const simulated = simulateColor(fromFigmaRgb(paint.color), mode);
        replacements.push({ nodeId: node.id, fillIndex, color: toFigmaRgb(simulated) });
      });
    }
    return {
      sourceNodeId: payload.nodes[0]?.id ?? "",
      label: `Simulated: ${mode}`,
      replacements,
      offsetX: (i + 1) * (width + GAP),
    };
  });
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd figma && npx vitest run src/shared/simulation.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Implement the sandbox renderer**

`figma/src/sandbox/simulate.ts`:

```ts
import type { SimulationFrameSpec } from "../shared/protocol";

/**
 * Clone each selected root, then walk original and clone in lockstep so
 * replacements addressed by the ORIGINAL node id land on the matching clone.
 * `clone()` preserves structure exactly, so the two walks stay aligned.
 * Originals are never mutated.
 */
export function renderSimulation(frames: SimulationFrameSpec[]): string[] {
  const roots = figma.currentPage.selection;
  if (roots.length === 0) return [];

  const created: string[] = [];

  for (const frame of frames) {
    const byNode = new Map<string, Map<number, { r: number; g: number; b: number }>>();
    for (const r of frame.replacements) {
      if (!byNode.has(r.nodeId)) byNode.set(r.nodeId, new Map());
      byNode.get(r.nodeId)!.set(r.fillIndex, r.color);
    }

    for (const root of roots) {
      const copy = root.clone();
      copy.x = root.x + frame.offsetX;
      copy.y = root.y;
      copy.name = `${root.name} ${frame.label}`;
      figma.currentPage.appendChild(copy);
      created.push(copy.id);

      const walk = (original: SceneNode, clone: SceneNode) => {
        const wanted = byNode.get(original.id);
        const fills = (clone as GeometryMixin).fills;
        if (wanted && Array.isArray(fills)) {
          const next = fills.map((p, i) => {
            const c = wanted.get(i);
            return c && p.type === "SOLID" ? { ...p, color: c } : p;
          });
          (clone as GeometryMixin).fills = next as Paint[];
        }
        const oKids = (original as ChildrenMixin).children;
        const cKids = (clone as ChildrenMixin).children;
        if (Array.isArray(oKids) && Array.isArray(cKids)) {
          oKids.forEach((k, i) => cKids[i] && walk(k, cKids[i]));
        }
      };
      walk(root, copy);
    }
  }

  return created;
}
```

- [ ] **Step 6: Wire the dispatcher case**

In `figma/src/sandbox/main.ts`, add above `default`:

```ts
      case "render-simulation": {
        const frameIds = renderSimulation(msg.frames);
        if (frameIds.length === 0) {
          reply({ id: msg.id, ok: false, reason: "no-selection", detail: "Select something to simulate first." });
          return;
        }
        reply({ id: msg.id, ok: true, type: "simulation-rendered", payload: { frameIds } });
        return;
      }
```

and the import: `import { renderSimulation } from "./simulate";`

- [ ] **Step 7: Implement the tab**

`figma/src/ui/SimulateTab.tsx`:

```tsx
import { useState } from "react";
import { buildSimulationFrames, SIM_MODES } from "../shared/simulation";
import { send } from "./bridge";

export function SimulateTab() {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function simulate() {
    setBusy(true);
    setNote(null);
    try {
      const res = await send({ type: "read-selection" });
      if (!res.ok) { setNote(res.detail); return; }
      if (res.type !== "selection") return;

      const frames = buildSimulationFrames(res.payload, 400);
      const out = await send({ type: "render-simulation", frames });
      if (!out.ok) { setNote(out.detail); return; }
      if (out.type !== "simulation-rendered") return;
      setNote(`Placed ${out.payload.frameIds.length} copies beside the original. Your original is untouched.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <p style={{ opacity: 0.7 }}>
        Copies the selection once per vision type ({SIM_MODES.join(", ")}) and rewrites every solid fill.
        Image and gradient fills are left alone rather than given an invented colour.
      </p>
      <button onClick={simulate} disabled={busy} style={{ width: "100%", padding: 8, cursor: "pointer" }}>
        Simulate selection
      </button>
      {note && <p>{note}</p>}
    </section>
  );
}
```

- [ ] **Step 8: Build and run every test**

Run: `cd figma && npm run build && npx vitest run`
Expected: build succeeds (the shell now has all three tab components) and every test passes.

- [ ] **Step 9: Commit**

```bash
git add figma/src/shared/simulation.ts figma/src/shared/simulation.test.ts figma/src/sandbox/simulate.ts figma/src/ui/SimulateTab.tsx figma/src/sandbox/main.ts
git commit -m "feat(figma): Simulate tab rendering CVD copies onto the canvas

Clones walk in lockstep with their originals so replacements addressed by
the original node id land correctly. Image and gradient fills are left as
they are rather than given an invented colour. Originals are never mutated.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 15: Verification in Figma desktop

"The build succeeded" is not verification. Plugin development is Figma desktop only; browser Figma has no `Plugins -> Development` menu. Figma.app is installed on this machine.

Do this in a new scratch design file, never in a real work file.

**Files:**
- Modify: `figma/README.md` (record the results)

**Interfaces:**
- Consumes: everything built in Tasks 2 through 14.
- Produces: nothing code-level. Produces the evidence that Plan 1 is done.

- [ ] **Step 1: Build and import**

```bash
cd figma && npm run build
```
In Figma desktop: Plugins, Development, Import plugin from manifest, choose `figma/manifest.json`. Create a new design file for the rest of this task.
Expected: all three commands appear in the Development menu.

- [ ] **Step 2: Generate writes correct variables in both modes**

Run Generate, set N to 6, press Write variables. Open the Variables panel.
Expected: a `Chart Color System` collection with `Light` and `Dark` modes. `chart/series/1/color` through `chart/series/6/color` are COLOR and differ between modes. `chart/series/N/dash`, `/decal`, `/shape` are STRING and identical across modes. The four chrome tokens exist.

- [ ] **Step 3: Variables survive a reload**

Close the file tab and reopen it. Open the Variables panel.
Expected: every variable is still present with the same values. If they vanished, the write never committed.

- [ ] **Step 4: Re-running updates in place**

Run Generate again with the same settings and write.
Expected: exactly one `Chart Color System` collection. No `Chart Color System 2`. The summary reports updates rather than creations.

- [ ] **Step 5: A hand edit survives**

In the Variables panel, change `chart/series/3/color` in Light mode to an obviously different colour. Run Generate and press Write variables.
Expected: the panel reports that a variable changed since it last wrote, lists `chart/series/3/color (light)`, and does not overwrite it. Choose Overwrite these and confirm it then changes. This is item 12 of the spec's verification bar.

- [ ] **Step 6: Audit matches the engine**

Draw three rectangles on a white frame with fills `#767676`, `#777777`, and `#ffffff`. Select all three and run Audit.
Expected: the background resolves to the frame's white, each contrast figure is reported, and the white-on-white row shows a contrast near 1.00. Cross-check one number by hand: `#767676` on `#ffffff` is about 4.54 to 1.

- [ ] **Step 7: Audit refuses what it cannot defend**

Place a rectangle on a frame whose fill is an image, select it, and run Audit.
Expected: refusal naming the image backdrop, with no contrast numbers. Then select a rectangle with an image fill on a white frame.
Expected: the fill appears under "not audited" with the image-fill reason, not as a passing row. This is items 6 and 13 of the verification bar.

- [ ] **Step 8: Simulate leaves the original alone**

Select a frame containing several coloured shapes and run Simulate.
Expected: four labelled copies appear to the right, visibly wrong in the expected ways, and the original is pixel-identical. Undo once.

- [ ] **Step 9: Panel state survives a relaunch**

Set N to 9 and posture to exploratory, close the plugin, reopen it from any command.
Expected: N is 9 and posture is exploratory. This is item 14 of the verification bar.

- [ ] **Step 10: Exercise the one-mode fallback if reachable**

If a one-mode plan is available, run Generate there.
Expected: a second `Chart Color System Dark` collection, and the panel says plainly that this keeps both sets of values but that switching theme means rebinding.

If no such plan is reachable, record that explicitly in `figma/README.md` as untested rather than claiming it passed.

- [ ] **Step 11: Finish the Spike A remainder, the node ceiling**

This is the one measurement still outstanding from Spike A, and it sets a constant that only Plan 2 consumes. It is here because it needs the same Figma session.

Paste `docs/spikes/` chart SVGs of increasing size into a scratch file, **with the Move tool explicitly selected first**. A previous attempt fired while the Text tool was active and pasted 795KB of SVG source into a text node, which proved nothing.

Record in `figma/README.md`: the largest element count that imports in under about five seconds, and the count at which Figma becomes unresponsive.

- [ ] **Step 12: Record the results and commit**

Append a "Verified" section to `figma/README.md` listing each step above with pass, fail, or untested, plus the two node-ceiling numbers and the date.

```bash
git add figma/README.md
git commit -m "docs(figma): record Plan 1 verification in Figma desktop

Every step of the spec's verification bar that Plan 1 covers, with its
result, plus the node-ceiling measurement that completes Spike A.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

Run against `docs/superpowers/specs/2026-09-14-figma-plugin-design.md`.

**Spec coverage.** Commands 1 through 3 are Tasks 12, 13, 14. The shared background resolver with one refusal set is Task 6, consumed by both Generate and Audit. Hand-edit protection is Tasks 7 and 9, verified in Task 15 step 5. Persistence is Task 10. P0 is Task 1. The variable schema including the three reference STRING variables is Task 7. The `addMode` fallback is Task 9. The wide v1 audit refusal set is Tasks 5, 6, and 13. The verification bar items that belong to Plan 1 are Task 15.

**Deliberately out of scope, and why.** Mockups, `gate.ts`, `budget.ts`, the SVG snapshot tests, the no-pattern invariant, P1 barrel exports, P2 extraction, and the relicense are all Plan 2. Each depends on `bestPractices`, `chartKinds`, `builtinBounds`, `fixtures`, or `echartsTheme`, none of which Plan 1 may touch.

**One spec deviation, stated in Global Constraints.** The spec says posture derives from chart kind. Chart kinds are Plan 2, so Plan 1 exposes posture directly from the MIT `POSTURE` constant and caps N at `min(MAX_SLOTS, POSTURE[posture].maxCategorical)`. `safeMaxN` is proprietary and DOM-welded, so it is unavailable; the live `auditPalette` verdict carries that weight instead. When Mockup lands, chart kind takes over.

**One addition the spec does not name.** `shared/defaults.ts` in Task 12. Plan 1 cannot read the token contract, because `src/index.css` is proprietary and the package ships no CSS, so the plugin defines its own neutral chrome with contrast floors enforced by test. These values are the plugin's own, not copied.

**Type consistency.** `VariableSpec`, `WrittenRecord`, and `Drift` are declared in Task 7's `spec.ts` and re-exported from Task 4's `protocol.ts`, so later tasks have one import site. Because of that cycle, **Task 7 must be implemented before Task 4's test will compile**; Task 4 step 4 says so. `FigmaRgb` is declared once in Task 3. `SkipReason` is declared in Task 5 and its copy map lives in Task 13. `resolveBackground` returns `{ ok: true; color; fromNodeId }` in Task 6 and every consumer reads `.color`.

**Placeholder scan.** No TBDs. Every code step carries real code. Task 15 is the only task without code, because its deliverable is evidence rather than software.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-15-figma-plugin-plan-1.md`. Two execution options:

**1. Subagent-Driven (recommended)** - a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.

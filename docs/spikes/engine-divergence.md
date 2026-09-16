# The solver returns a different answer per JavaScript engine

Measured 2026-09-16. Reproduced independently in this session after
`visualizations-47` reported the palette divergence; the verdict disagreements
below are new.

## Method

`src/charts/index.ts` bundled once with esbuild to a self-contained IIFE, so
every engine runs **identical bytes**. The same bundle was then executed under:

- Node 24 (V8) — `node`
- Chrome 152.0.7977.76 (V8) — evaluated in the page
- JavaScriptCore — `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc`

Sweep: every posture (kpi, comparative, exploratory) x every N up to that
posture's cap x two backgrounds (#ffffff, #0b0e14) = 64 configurations.
`solveCategorical` then `auditPalette`. Each engine is internally
deterministic; repeated runs give identical output.

## Result

**49 of 64 configurations produce a different palette between Node and
JavaScriptCore.**

`n=6, comparative, #ffffff`:

| engine | palette | min ΔE | min CVD ΔE |
|---|---|---|---|
| Node 24 (V8) | `#00515f #0087ab #637039 #271366 #8400ab #463600` | 13.8033 | 11.5769 |
| Chrome 152 (V8) | `#2080c3 #0056aa #584503 #370d91 #45142b #bc006f` | 12.3867 | 9.7938 |
| JavaScriptCore | `#736c00 #003c5c #5c4300 #006470 #2080c3 #421e00` | 12.6740 | 12.1967 |

Node and Chrome are **both V8** and still disagree, so this is build-specific
inside one engine family. "It works in Chrome" is a statement about one build.

## The part that matters

Different colours would be survivable. Different **verdicts** are not. Ten
configurations disagree on the accessibility result itself:

| posture | N | background | Node | JavaScriptCore | Chrome |
|---|---|---|---|---|---|
| kpi | 7 | #0b0e14 | **pass** | warn | **fail** |
| kpi | 7 | #ffffff | warn | **fail** | warn |
| comparative | 7 | #ffffff | **pass** | warn | **fail** |
| comparative | 8 | #ffffff | warn | warn | **pass** |
| comparative | 9 | #0b0e14 | **fail** | **pass** | **fail** |
| comparative | 9 | #ffffff | pass | warn | warn |
| exploratory | 8 | #0b0e14 | warn | **pass** | warn |
| exploratory | 8 | #ffffff | pass | pass | warn |
| exploratory | 9 | #0b0e14 | **pass** | warn | pass |
| exploratory | 9 | #ffffff | **pass** | warn | pass |

The product tells one user a palette passes and another that the same
configuration fails.

## Cause

Not the PRNG — that is `Math.imul` integer arithmetic and is exact. The
annealer's acceptance test is `r() < Math.exp(f / (10 * t))`, and the OKLab
conversions run `cbrt` and `**`. ECMAScript does not require these to be
correctly rounded, so a last-bit difference flips a comparison and the
annealing path diverges from there.

## Scope

Every configuration at **N ≤ 6 agrees across all three engines**. The
disagreements start at N = 7, which is exactly the range `safeMaxN` reports as
unsafe and which the old unconditional clamp made unreachable. Opening that
range up (ed0cfa1) is what makes this reachable by a user, and the WARN shown
there is honest as far as it goes - but the numbers printed beside it are not
reproducible on another engine.

## Consequences, unfixed

- A shared palette link renders different colours for the recipient.
- The MCP server runs on Vercel's Node, so an assistant's answer will not match
  what the user sees on screen.
- The Figma plugin solves in the UI iframe (`figma/src/ui/GenerateTab.tsx`), so
  Figma desktop, Figma in Safari, and this site can each produce a different
  palette from the same locked brand anchors.
- The test suite runs in Node and therefore certifies palettes that no browser
  user ever receives. `builtinBuilderInvariant.test.ts` proves a property of the
  Node palette, not of the shipped one.

## Fixed 2026-09-16

Option 1. `src/charts/palette/deterministic.ts` provides `ln`, `exp` and `pow`
built only from operations ECMAScript requires to be correctly rounded - `+`,
`-`, `*`, `/`, `Math.sqrt`, `Math.round`. `ln` is range-reduced to [1,2) by
exact halving then evaluated as an atanh series; `exp` is range-reduced to
|r| <= ln2/2 then a Taylor polynomial, scaled by a power of two through exact
doubling. Both agree with the platform's own functions to within 1e-12, which
`deterministic.test.ts` asserts across 2000 points, and a guard in that suite
fails if the module ever reaches for `Math.pow`, `Math.exp`, `Math.cbrt` or
trigonometry again.

Wired in at:

- the annealer's acceptance test in `categorical.ts` - the branch the entire
  search turns on
- both sRGB transfer functions in `cvd.ts`, which feed every simulation
- both in `audit.ts`, which feed contrast and the greyscale projection

And every `ColorRecord` is now normalised at construction: rgb snapped to the
8-bit grid it will actually be rendered at, oklab quantised to 1e-6. The snap
was a correctness fix in its own right - a record used to carry
full-precision rgb with an oklab derived from it while its `hex` was the 8-bit
rounding of that rgb, so the record's distance maths described a colour
slightly different from the one it named and from the one anyone would see.

### Verification

The same 64-configuration sweep, same method, after the change:

| comparison | differing configurations |
|---|---|
| Node 24 vs JavaScriptCore | **0 of 64** |
| Chrome 152 vs Node 24 | **0 of 64** |
| Chrome 152 vs JavaScriptCore | **0 of 64** |

Byte-identical palettes, relaxations and verdicts on all three engines. The
Chrome comparison was done by fetching the Node and JSC outputs into the page
and diffing there, rather than by transcribing them.

`safeMaxN` still measures 6 for every theme and posture, so the "safe cap (6)"
copy in the builder remains correct. Every palette in the product changed
once, hence PALETTE_VERSION 0.8.0.

## Options that were considered

1. **Replace the transcendentals in the hot path** with deterministic
   implementations (fixed-point or a pinned polynomial for `exp`, `cbrt`).
   Actually fixes it. Changes every palette once, so it is a PALETTE_VERSION
   bump and a regeneration of the frozen benchmark facts.
2. **Quantize every comparison** to a fixed precision before branching. Cheaper,
   but only makes a flip rarer rather than impossible.
3. **Precompute and ship the palettes** for the built-in configurations, and
   solve at runtime only for custom backgrounds. Removes the divergence from
   everything the site and the plugin show by default.

Option 1 was taken. It changes every palette in the product once, which is why
the version bumped.

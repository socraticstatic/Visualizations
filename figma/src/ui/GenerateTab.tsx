import { useMemo, useState } from "react";
import { solveCategorical } from "@engine/palette/categorical";
import { auditPalette, contrastRatio, simulateColor, type VisionMode } from "@engine/audit";
import { POSTURE, type Posture } from "@engine/constraints";
import { MAX_SLOTS } from "@engine/encoding";
import { DEFAULT_TOKENS } from "../shared/defaults";
import { buildVariableSpec, type Drift } from "../shared/spec";
import { isUnlocked, type LicenseStatus } from "../shared/license";
import { send } from "./bridge";
import { DashPreview, ShapeMarker, DecalSwatch } from "./Encoding";
import { Specimen } from "./Specimen";

const VISION: Array<{ mode: VisionMode; label: string; note: string }> = [
  { mode: "normal", label: "Normal", note: "baseline" },
  { mode: "deutan", label: "Deutan", note: "red-green, ~6% of men" },
  { mode: "protan", label: "Protan", note: "red-green, ~2% of men" },
  { mode: "tritan", label: "Tritan", note: "blue-yellow, rare" },
  { mode: "achromatopsia", label: "Mono", note: "print, projector, grayscale" },
];

const POSTURES = Object.keys(POSTURE) as Posture[];

export function GenerateTab({
  theme,
  license,
}: {
  theme: "light" | "dark";
  license: LicenseStatus | null;
}) {
  const [drift, setDrift] = useState<Drift[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posture, setPosture] = useState<Posture>("comparative");
  const [requestedN, setRequestedN] = useState(6);

  const tokens = DEFAULT_TOKENS[theme];
  const cap = Math.min(MAX_SLOTS, POSTURE[posture].maxCategorical);
  const n = Math.min(requestedN, cap);

  const solve = useMemo(
    () =>
      solveCategorical({
        n,
        posture,
        background: tokens.surface,
        grid: tokens.grid,
        locks: [],
      }),
    [n, posture, tokens]
  );

  const audit = useMemo(() => auditPalette(solve.palette, tokens.surface), [solve, tokens]);

  /** Both modes are solved, because a variable needs a value in each. */
  const specs = useMemo(() => {
    const forTheme = (t: "light" | "dark") => {
      const tk = DEFAULT_TOKENS[t];
      return {
        palette: solveCategorical({ n, posture, background: tk.surface, grid: tk.grid, locks: [] }).palette,
        surface: tk.surface,
        grid: tk.grid,
        axis: tk.axis,
        label: tk.label,
      };
    };
    return buildVariableSpec({ light: forTheme("light"), dark: forTheme("dark") });
  }, [n, posture]);

  const canWrite = isUnlocked("write-variables", license);

  async function write(confirmedOverwrites: string[] = []) {
    setBusy(true);
    setSummary(null);
    try {
      const res = await send({ type: "write-variables", specs, confirmedOverwrites });
      if (!res.ok) {
        setSummary(res.detail);
        return;
      }
      if (res.type !== "variables-written") return;
      const p = res.payload;
      setDrift(null);
      setSummary(
        `${p.created} created, ${p.updated} updated` +
          (p.skipped ? `, ${p.skipped} left as you had them` : "") +
          "." +
          (p.usedFallbackCollection
            ? " Your plan allows one mode per collection, so Dark went into a second collection. That keeps both sets of values, but switching theme means rebinding."
            : "")
      );
    } finally {
      setBusy(false);
    }
  }

  async function writeChecked() {
    const prev = await send({ type: "read-written-record" });
    if (prev.ok && prev.type === "written-record" && prev.payload) {
      const { diffWritten, recordFromSpecs } = await import("../shared/spec");
      const d = diffWritten(prev.payload, recordFromSpecs(specs));
      if (d.length > 0) {
        setDrift(d);
        return;
      }
    }
    await write();
  }

  const verdict = audit.overall;

  return (
    <>
      <section className="controls">
        <label className="field">
          <span className="field__label">Posture</span>
          <select
            className="select"
            value={posture}
            onChange={(e) => setPosture(e.target.value as Posture)}
          >
            {POSTURES.map((p) => (
              <option key={p} value={p}>
                {p} · up to {POSTURE[p].maxCategorical}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="field__label">
            Series <span className="num field__value">{n}</span>
            <span className="field__hint"> of {cap}</span>
          </span>
          <div className="stepper">
            <button
              className="stepper__btn"
              onClick={() => setRequestedN((v) => Math.max(1, Math.min(v, cap) - 1))}
              disabled={n <= 1}
              aria-label={`Decrease to ${n - 1}`}
            >
              −
            </button>
            <input
              className="stepper__range"
              type="range"
              min={1}
              max={cap}
              value={n}
              aria-label="Number of series"
              onChange={(e) => setRequestedN(Number(e.target.value))}
            />
            <button
              className="stepper__btn"
              onClick={() => setRequestedN((v) => Math.min(cap, Math.min(v, cap) + 1))}
              disabled={n >= cap}
              aria-label={`Increase to ${n + 1}`}
            >
              +
            </button>
          </div>
        </div>
      </section>

      <section className={`verdict verdict--${verdict}`}>
        <strong className="verdict__label">{verdict}</strong>
        <dl className="verdict__stats">
          <div>
            <dt>worst vs background</dt>
            <dd className="num">{audit.worstContrastVsBg.toFixed(2)}:1</dd>
          </div>
          <div>
            <dt>min ΔE</dt>
            <dd className="num">{solve.minPairDeltaE.toFixed(1)}</dd>
          </div>
          <div>
            <dt>min ΔE under CVD</dt>
            <dd className="num">{solve.minCvdDeltaE.toFixed(1)}</dd>
          </div>
        </dl>
        {solve.relaxations.length > 0 ? (
          <p className="verdict__relax">
            Relaxed to reach {n}: {solve.relaxations.join(", ")}. Lower N to restore.
          </p>
        ) : (
          <p className="verdict__relax">No floor was relaxed to reach {n}.</p>
        )}
      </section>

      <section>
        <h2 className="section__title">
          Slots
          <span className="section__note">colour, dash, marker, decal — all four carry identity</span>
        </h2>
        <ol className="slots">
          {solve.palette.map((c, i) => (
            <li className="slot" key={i}>
              <span className="slot__index num">{i + 1}</span>
              <span className="slot__chip" style={{ background: c.hex }} />
              <code className="slot__hex num">{c.hex}</code>
              <DashPreview slot={i} color={c.hex} />
              <ShapeMarker slot={i} color={c.hex} />
              <DecalSwatch slot={i} color={c.hex} />
              <span className="slot__contrast num">
                {contrastRatio(c, tokens.surface).toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="section__title">
          Vision
          <span className="section__note">what other people receive. Colour dies in the last row; dash and marker do not.</span>
        </h2>
        <div className="vision">
          {VISION.map((v) => (
            <div className="vision__row" key={v.mode}>
              <div className="vision__meta">
                <span className="vision__label">{v.label}</span>
                <span className="vision__note">{v.note}</span>
              </div>
              <div className="vision__strip" style={{ background: tokens.surface.hex }}>
                {solve.palette.map((c, i) => (
                  <Specimen
                    key={i}
                    slot={i}
                    color={simulateColor(c, v.mode).hex}
                    surface={tokens.surface.hex}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="write">
        {drift ? (
          <div className="drift">
            <p>
              {drift.length} variable{drift.length === 1 ? "" : "s"} changed since this plugin last
              wrote. Your edits are kept unless you say otherwise.
            </p>
            <ul>
              {drift.slice(0, 6).map((d) => (
                <li key={`${d.name}:${d.mode}`}>
                  <code className="num">{d.name}</code> <span className="drift__mode">{d.mode}</span>
                </li>
              ))}
            </ul>
            <div className="write__actions">
              <button className="btn" disabled={busy} onClick={() => void write(drift.map((d) => d.name))}>
                Overwrite these
              </button>
              <button className="btn btn--quiet" disabled={busy} onClick={() => setDrift(null)}>
                Keep mine
              </button>
            </div>
          </div>
        ) : (
          <button className="btn" disabled={busy || !canWrite} onClick={() => void writeChecked()}>
            {busy ? "Writing" : `Write ${specs.length} variables into this file`}
          </button>
        )}
        {!canWrite && (
          <p className="note">
            Writing variables, Dev Mode codegen and mockups need a licence. Auditing and simulating
            do not, and never will.
          </p>
        )}
        {summary && <p className="note">{summary}</p>}
      </section>
    </>
  );
}

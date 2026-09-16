import { useMemo, useState } from "react";
import { solveCategorical } from "@engine/palette/categorical";
import { auditPalette } from "@engine/audit";
import { POSTURE, type Posture } from "@engine/constraints";
import { PALETTE_VERSION } from "@engine/version";
import { DEFAULT_TOKENS } from "../shared/defaults";
import { buildMockup, MAX_MOCKUP_NODES } from "../shared/mockup";
import { isUnlocked, type LicenseStatus } from "../shared/license";
import { send } from "./bridge";

const POSTURES = Object.keys(POSTURE) as Posture[];

/**
 * Put a chart on the canvas that cannot be a bad chart.
 *
 * The palette is solved and audited before anything is drawn, and the verdict,
 * every relaxation and every advisory are rendered INTO the frame rather than
 * shown here and forgotten. A mockup that leaves this panel carries its own
 * evidence, including the one encoding Figma cannot represent.
 */
export function MockupTab({
  theme,
  license,
}: {
  theme: "light" | "dark";
  license: LicenseStatus | null;
}) {
  const [posture, setPosture] = useState<Posture>("comparative");
  const [n, setN] = useState(6);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const tokens = DEFAULT_TOKENS[theme];
  const cap = POSTURE[posture].maxCategorical;
  const count = Math.min(n, cap);

  const mockup = useMemo(() => {
    const solve = solveCategorical({
      n: count,
      posture,
      background: tokens.surface,
      grid: tokens.grid,
      locks: [],
    });
    const audit = auditPalette(solve.palette, tokens.surface);
    const advisories: string[] = [];
    if (count > 7) advisories.push("Past ~7 series a chart reads as busy; small multiples often work better.");
    if (audit.worstContrastVsBg < 3) {
      advisories.push(`Worst contrast is ${audit.worstContrastVsBg.toFixed(2)}:1, under the 3:1 non-text floor.`);
    }
    return buildMockup({
      n: count,
      kind: "line",
      palette: solve.palette,
      tokens,
      verdict: audit.overall,
      relaxations: solve.relaxations,
      advisories,
      engineVersion: PALETTE_VERSION,
    });
  }, [count, posture, tokens]);

  const canInsert = isUnlocked("mockup", license);

  async function insert() {
    setBusy(true);
    setSummary(null);
    try {
      const res = await send({
        type: "insert-mockup",
        svg: mockup.svg,
        frameName: mockup.frameName,
        nodeEstimate: mockup.nodeEstimate,
      });
      setSummary(
        res.ok && res.type === "mockup-inserted"
          ? `${res.payload.nodes} nodes placed as “${res.payload.frameName}”.`
          : res.ok
          ? null
          : res.detail
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="controls">
        <label className="field">
          <span className="field__label">Posture</span>
          <select className="select" value={posture} onChange={(e) => setPosture(e.target.value as Posture)}>
            {POSTURES.map((p) => (
              <option key={p} value={p}>
                {p} · up to {POSTURE[p].maxCategorical}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="field__label">
            Series <span className="num field__value">{count}</span>
            <span className="field__hint"> of {cap}</span>
          </span>
          <div className="stepper">
            <button className="stepper__btn" onClick={() => setN((v) => Math.max(1, Math.min(v, cap) - 1))} disabled={count <= 1} aria-label={`Decrease to ${count - 1}`}>−</button>
            <input className="stepper__range" type="range" min={1} max={cap} value={count} aria-label="Number of series" onChange={(e) => setN(Number(e.target.value))} />
            <button className="stepper__btn" onClick={() => setN((v) => Math.min(cap, Math.min(v, cap) + 1))} disabled={count >= cap} aria-label={`Increase to ${count + 1}`}>+</button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="section__title">
          Preview
          <span className="section__note">exactly what lands on the canvas</span>
        </h2>
        {mockup.refusal ? (
          <p className="note">{mockup.refusal}</p>
        ) : (
          <div
            className="mockup-preview"
            aria-label="Chart mockup preview"
            dangerouslySetInnerHTML={{ __html: mockup.svg }}
          />
        )}
      </section>

      <section className="write">
        <button className="btn" disabled={busy || !canInsert || !!mockup.refusal} onClick={() => void insert()}>
          {busy ? "Inserting" : `Insert mockup (~${mockup.nodeEstimate} nodes)`}
        </button>
        <p className="note">
          Decal is the one encoding Figma cannot represent: it discards pattern fills on SVG import.
          The frame says so on its face, so nobody downstream assumes otherwise.
        </p>
        {!canInsert && (
          <p className="note">Inserting mockups needs a licence. Auditing and simulating do not.</p>
        )}
        {mockup.nodeEstimate > MAX_MOCKUP_NODES * 0.75 && !mockup.refusal && (
          <p className="note">Approaching the {MAX_MOCKUP_NODES}-node ceiling.</p>
        )}
        {summary && <p className="note">{summary}</p>}
      </section>
    </>
  );
}

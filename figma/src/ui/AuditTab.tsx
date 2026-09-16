import { useEffect, useState } from "react";
import { auditPalette, contrastRatio, type AuditReport } from "@engine/audit";
import type { ColorRecord } from "@engine/palette/distance";
import { compositeOver } from "../shared/color";
import { extractFills, SKIP_REASON_COPY, type ExtractedFill } from "../shared/fills";
import { resolveBackground, BACKGROUND_REFUSAL_COPY } from "../shared/background";
import type { SelectionPayload } from "../shared/protocol";
import { onSelectionChange, send } from "./bridge";

interface Audited {
  fill: ExtractedFill;
  composited: ColorRecord;
  contrast: number;
}

interface Run {
  background: ColorRecord | null;
  backgroundNote: string | null;
  audited: Audited[];
  skipped: ExtractedFill[];
  report: AuditReport | null;
  read: number;
  total: number;
  truncated: boolean;
}

function run(payload: SelectionPayload): Run {
  const resolved = resolveBackground(payload.backdrop);
  const background = resolved.ok ? resolved.color : null;
  const backgroundNote = resolved.ok ? null : BACKGROUND_REFUSAL_COPY[resolved.reason];

  const all = extractFills(payload.nodes);
  const skipped = all.filter((f) => f.status === "skipped");
  if (!background) {
    return {
      background: null, backgroundNote, audited: [], skipped, report: null,
      read: payload.nodes.length, total: payload.total, truncated: payload.truncated,
    };
  }

  const audited = all
    .filter((f) => f.status === "auditable" && f.color)
    .map((f) => {
      const composited = compositeOver(f.color!, f.alpha ?? 1, background);
      return { fill: f, composited, contrast: contrastRatio(composited, background) };
    });

  return {
    background,
    backgroundNote,
    audited,
    skipped,
    report: audited.length >= 2 ? auditPalette(audited.map((a) => a.composited), background) : null,
    read: payload.nodes.length,
    total: payload.total,
    truncated: payload.truncated,
  };
}

export function AuditTab() {
  const [state, setState] = useState<Run | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await send({ type: "read-selection" });
      if (res.ok && res.type === "selection") setState(run(res.payload));
      else setEmpty(true);
    })();
    return onSelectionChange((payload) => {
      setEmpty(payload.nodes.length === 0);
      setState(payload.nodes.length ? run(payload) : null);
    });
  }, []);

  if (empty || !state) {
    return (
      <p className="note">
        Select layers on the canvas. This follows your selection, so there is nothing to press.
      </p>
    );
  }

  const { report, background } = state;

  return (
    <>
      {state.truncated && (
        <p className="refusal">
          This selection has {state.total} layers and this reads the first {state.read}. The verdict
          below covers those only, so treat it as a sample rather than a result. Select fewer layers
          for a number you can stand behind.
        </p>
      )}

      {state.backgroundNote && (
        <p className="refusal">
          {state.backgroundNote} Contrast is measured against a background, so there is no honest
          number to report until there is one.
        </p>
      )}

      {report && (
        <section className={`verdict verdict--${report.overall}`}>
          <strong className="verdict__label">{report.overall}</strong>
          <dl className="verdict__stats">
            <div>
              <dt>worst vs background</dt>
              <dd className="num">{report.worstContrastVsBg.toFixed(2)}:1</dd>
            </div>
            <div>
              <dt>fills measured</dt>
              <dd className="num">{state.audited.length}</dd>
            </div>
            <div>
              <dt>not measured</dt>
              <dd className="num">{state.skipped.length}</dd>
            </div>
          </dl>
          {background && (
            <p className="verdict__relax">
              Against <code className="num">{background.hex}</code>, resolved from the layers behind
              your selection.
            </p>
          )}
        </section>
      )}

      {state.audited.length > 0 && (
        <section>
          <h2 className="section__title">
            Measured
            <span className="section__note">composited through opacity, as the eye receives it</span>
          </h2>
          <ol className="slots">
            {state.audited.map((a, i) => (
              <li className="slot slot--audit" key={i}>
                <span className="slot__chip" style={{ background: a.composited.hex }} />
                <span className="slot__name">
                  {a.fill.nodeName}
                  {a.fill.source === "gradient-stop" ? ` · stop ${a.fill.stopIndex! + 1}` : ""}
                </span>
                <code className="slot__hex num">{a.composited.hex}</code>
                <span className={`slot__contrast num ${a.contrast < 3 ? "is-bad" : ""}`}>
                  {a.contrast.toFixed(2)}:1
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {state.skipped.length > 0 && (
        <details className="skipped">
          <summary>{state.skipped.length} not measured</summary>
          <ul>
            {state.skipped.map((s, i) => (
              <li key={i}>
                <strong>{s.nodeName}</strong> {SKIP_REASON_COPY[s.reason!]}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

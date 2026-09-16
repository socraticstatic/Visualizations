import { useEffect, useState } from "react";
import { simulateColor, type VisionMode } from "@engine/audit";
import { fromFigmaRgb, toFigmaRgb } from "../shared/color";
import type { SelectionPayload, SimulationSpec } from "../shared/protocol";
import { MAX_SIMULATION_NODES, SIMULATION_COPIES } from "../shared/limits";
import { onSelectionChange, send } from "./bridge";

const MODES: Array<{ mode: VisionMode; label: string }> = [
  { mode: "deutan", label: "Deutan" },
  { mode: "protan", label: "Protan" },
  { mode: "tritan", label: "Tritan" },
  { mode: "achromatopsia", label: "Mono" },
];

const GAP = 40;

/** One frame per vision type, each carrying a replacement for every solid fill. */
export function buildFrames(payload: SelectionPayload, width: number): SimulationSpec[] {
  return MODES.map((m, i) => {
    const replacements: SimulationSpec["replacements"] = [];
    for (const node of payload.nodes) {
      if (node.fills === "mixed") continue;
      node.fills.forEach((paint, fillIndex) => {
        if (paint.kind !== "solid" || !paint.color) return;
        replacements.push({
          nodeId: node.id,
          fillIndex,
          color: toFigmaRgb(simulateColor(fromFigmaRgb(paint.color), m.mode)),
        });
      });
    }
    return { mode: m.mode, label: m.label, offsetX: (i + 1) * (width + GAP), replacements };
  });
}

export function SimulateTab() {
  const [payload, setPayload] = useState<SelectionPayload | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await send({ type: "read-selection" });
      if (res.ok && res.type === "selection") setPayload(res.payload);
    })();
    return onSelectionChange((p) => setPayload(p.nodes.length ? p : null));
  }, []);

  const tooMany = payload ? payload.total > MAX_SIMULATION_NODES : false;

  const solidCount = payload
    ? payload.nodes.reduce(
        (acc, n) => acc + (n.fills === "mixed" ? 0 : n.fills.filter((f) => f.kind === "solid").length),
        0
      )
    : 0;

  async function place() {
    if (!payload) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await send({ type: "render-simulation", frames: buildFrames(payload, 400) });
      setNote(
        res.ok && res.type === "simulation-rendered"
          ? `Placed ${res.payload.created} copies beside the original. Yours is untouched, and one undo removes them.`
          : res.ok
            ? null
            : res.detail
      );
    } finally {
      setBusy(false);
    }
  }

  if (!payload) {
    return <p className="note">Select something on the canvas. This follows your selection.</p>;
  }

  return (
    <>
      <p className="note">
        Copies your selection once per vision type and rewrites every solid fill to what that eye
        receives. Image and gradient fills are left alone rather than given an invented colour.
      </p>

      {tooMany && (
        <p className="refusal">
          This selection has {payload.total} layers. Simulating places{" "}
          {SIMULATION_COPIES} copies, so that would create around{" "}
          {payload.total * SIMULATION_COPIES} nodes at once and Figma will
          struggle. Select the legend, a few representative shapes, or one
          frame rather than a chart pasted as vectors.
        </p>
      )}

      <section className="verdict">
        <dl className="verdict__stats">
          <div>
            <dt>layers selected</dt>
            <dd className="num">{payload.total}</dd>
          </div>
          <div>
            <dt>solid fills to rewrite</dt>
            <dd className="num">{solidCount}</dd>
          </div>
          <div>
            <dt>copies to place</dt>
            <dd className="num">{MODES.length}</dd>
          </div>
        </dl>
        {payload.truncated && (
          <p className="verdict__relax">
            Reading the first {payload.nodes.length} of {payload.total} layers. Copies will carry
            simulated colours only for those.
          </p>
        )}
      </section>

      <button className="btn" disabled={busy || tooMany || solidCount === 0} onClick={() => void place()}>
        {busy ? "Placing" : `Place ${SIMULATION_COPIES} simulated copies`}
      </button>
      {solidCount === 0 && (
        <p className="note">Nothing in this selection has a solid fill to simulate.</p>
      )}
      {note && <p className="note">{note}</p>}
    </>
  );
}

import type { SimulationSpec } from "../shared/protocol";
import { MAX_SIMULATION_NODES } from "../shared/limits";

type Loose = Record<string, any>;

/**
 * Clone each selected root and rewrite its solid fills to the simulated
 * colours, laid out beside the original.
 *
 * Original and clone are walked in lockstep so replacements addressed by the
 * ORIGINAL node id land on the matching clone; clone() preserves structure
 * exactly, so the two walks stay aligned. Originals are never mutated, and
 * image and gradient fills are left alone rather than given an invented colour.
 */
export type SimulationOutcome =
  | { ok: true; created: number }
  | { ok: false; reason: "no-selection" | "too-many"; count: number };

function countNodes(roots: readonly SceneNode[]): number {
  let n = 0;
  const visit = (node: Loose) => {
    n++;
    const kids = node.children;
    if (Array.isArray(kids)) kids.forEach(visit);
  };
  roots.forEach((r) => visit(r as unknown as Loose));
  return n;
}

export function renderSimulation(frames: SimulationSpec[]): SimulationOutcome {
  const roots = figma.currentPage.selection;
  if (roots.length === 0) return { ok: false, reason: "no-selection", count: 0 };

  // The panel disables this, but the panel is not the authority: a selection can
  // change between the check and the call.
  const count = countNodes(roots);
  if (count > MAX_SIMULATION_NODES) return { ok: false, reason: "too-many", count };

  let created = 0;

  for (const frame of frames) {
    const byNode = new Map<string, Map<number, { r: number; g: number; b: number }>>();
    for (const r of frame.replacements) {
      if (!byNode.has(r.nodeId)) byNode.set(r.nodeId, new Map());
      byNode.get(r.nodeId)!.set(r.fillIndex, r.color);
    }

    for (const root of roots) {
      const copy = (root as unknown as Loose).clone() as SceneNode & Loose;
      copy.x = (root as Loose).x + frame.offsetX;
      copy.y = (root as Loose).y;
      copy.name = `${root.name} · ${frame.label}`;
      figma.currentPage.appendChild(copy);
      created++;

      const walk = (original: Loose, clone: Loose) => {
        const wanted = byNode.get(original.id);
        const fills = clone.fills;
        if (wanted && Array.isArray(fills)) {
          clone.fills = fills.map((p: Loose, i: number) => {
            const c = wanted.get(i);
            return c && p.type === "SOLID" ? { ...p, color: c } : p;
          });
        }
        const oKids = original.children;
        const cKids = clone.children;
        if (Array.isArray(oKids) && Array.isArray(cKids)) {
          oKids.forEach((k: Loose, i: number) => cKids[i] && walk(k, cKids[i]));
        }
      };
      walk(root as unknown as Loose, copy);
    }
  }

  figma.commitUndo();
  return { ok: true, created };
}

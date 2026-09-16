import type { SimulationSpec } from "../shared/protocol";

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
export function renderSimulation(frames: SimulationSpec[]): number {
  const roots = figma.currentPage.selection;
  if (roots.length === 0) return 0;

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
  return created;
}

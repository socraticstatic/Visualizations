/**
 * Place a mockup on the canvas.
 *
 * The sandbox stays dumb: the SVG is built and audited in the UI, and this
 * only imports it, names it and puts it somewhere the user can see. The one
 * judgement it makes is refusing a node count that would lock the editor,
 * and it refuses with the number rather than silently truncating.
 */
import { MAX_MOCKUP_NODES } from "../shared/limits";

export interface MockupResult {
  nodes: number;
  frameName: string;
}

/** The minimal rectangle a placement needs to know about. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const GAP = 64;

/**
 * An x for `box` at its current y that clears every rectangle in `others`.
 *
 * Walks right from the proposed position, re-checking after each nudge because
 * moving clear of one neighbour can push the frame into the next. Only vertical
 * overlap counts: a frame on another row is not in the way.
 *
 * Exported for tests; it is pure arithmetic and needs no Figma document.
 */
export function clearOf(box: Box, others: readonly Box[]): number {
  let x = box.x;
  // Bounded by the number of obstacles: each pass clears at least one, and a
  // frame cannot be pushed past the same neighbour twice.
  for (let pass = 0; pass <= others.length; pass++) {
    let moved = false;
    for (const o of others) {
      if (o === (box as unknown as Box)) continue;
      const sharesRows = box.y < o.y + o.height && o.y < box.y + box.height;
      const overlapsX = x < o.x + o.width && o.x < x + box.width;
      if (sharesRows && overlapsX) {
        x = o.x + o.width + GAP;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return x;
}

/** What a node actually occupies on the page, rotation included. */
export function absoluteBox(node: Box & { absoluteBoundingBox?: Box | null }): Box {
  const abs = node.absoluteBoundingBox;
  if (abs && Number.isFinite(abs.x) && Number.isFinite(abs.width)) return abs;
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

export function insertMockup(svg: string, frameName: string, nodeEstimate: number): MockupResult {
  if (nodeEstimate > MAX_MOCKUP_NODES) {
    throw new Error(
      `Refusing to create about ${nodeEstimate} nodes; the ceiling is ${MAX_MOCKUP_NODES}.`
    );
  }

  const node = figma.createNodeFromSvg(svg);
  node.name = frameName;

  // Place it beside whatever is selected, or in the middle of the viewport
  // when nothing is. Landing on top of the user's work is its own defect.
  const sel = figma.currentPage.selection;
  if (sel.length > 0) {
    let right = -Infinity;
    let top = Infinity;
    for (const s of sel) {
      // A selection nested inside a frame reports x and width in its PARENT's
      // space, and the mockup is appended to the page. Using the local numbers
      // as page coordinates lands the frame on top of the very work the user
      // selected inside. absoluteBoundingBox is what the node actually occupies.
      const box = absoluteBox(s);
      right = Math.max(right, box.x + box.width);
      top = Math.min(top, box.y);
    }
    node.x = Math.round(right + GAP);
    node.y = Math.round(top);
    node.x = Math.round(clearOf(node, figma.currentPage.children));
  } else {
    // Nothing selected. The viewport centre is exactly where the user's work
    // is, so centring there lands on top of it - which is the defect the note
    // above disclaims. Start from the centre, then walk right past everything
    // already on the page that the frame would intersect.
    node.x = Math.round(figma.viewport.center.x - node.width / 2);
    node.y = Math.round(figma.viewport.center.y - node.height / 2);
    node.x = Math.round(clearOf(node, figma.currentPage.children));
  }

  figma.currentPage.appendChild(node);
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);

  return { nodes: node.findAll(() => true).length + 1, frameName };
}

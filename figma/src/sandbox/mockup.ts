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
      right = Math.max(right, s.x + s.width);
      top = Math.min(top, s.y);
    }
    node.x = Math.round(right + 64);
    node.y = Math.round(top);
  } else {
    node.x = Math.round(figma.viewport.center.x - node.width / 2);
    node.y = Math.round(figma.viewport.center.y - node.height / 2);
  }

  figma.currentPage.appendChild(node);
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);

  return { nodes: node.findAll(() => true).length + 1, frameName };
}

/**
 * The published surface has to agree with the engine in this tree.
 *
 * PALETTE_VERSION 0.8.0 changed real output: every palette moved when the
 * solver was made deterministic across JavaScript engines. Anything still
 * pinned to an older version is serving results this tree no longer produces,
 * and nothing guarded that - the drift was found by a peer session reading the
 * live site, not by the suite.
 *
 * This test is expected to FAIL between an engine change and the publish that
 * follows it. That is the point: a half-finished release should be loud. The
 * message says exactly what to run.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PALETTE_VERSION } from "@/charts/version";

const ROOT = join(__dirname, "..", "..", "..");

/** Lowest version a caret range admits, e.g. "^0.7.3" -> [0,7,3]. */
function caretFloor(range: string): number[] {
  return range.replace(/^[^\d]*/, "").split(".").map(Number);
}

/** A caret range on 0.x only admits that same minor. */
function caretAdmits(range: string, version: string): boolean {
  const [rMaj, rMin] = caretFloor(range);
  const [vMaj, vMin, vPatch] = version.split(".").map(Number);
  const [, , rPatch] = caretFloor(range);
  if (rMaj !== vMaj) return false;
  if (rMaj === 0) return rMin === vMin && vPatch >= rPatch;
  return vMin > rMin || (vMin === rMin && vPatch >= rPatch);
}

describe("published surface", () => {
  it("has the MCP server depending on an engine that can produce today's palettes", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "mcp", "package.json"), "utf8"));
    const range: string = pkg.dependencies?.["chart-color-system"] ?? "";
    expect(range, "mcp/package.json must depend on chart-color-system").toBeTruthy();

    if (!caretAdmits(range, PALETTE_VERSION)) {
      throw new Error(
        `The deployed MCP server depends on chart-color-system "${range}", which cannot ` +
          `resolve to ${PALETTE_VERSION}. It is answering assistants with palettes this ` +
          `tree no longer produces.\n\n` +
          `Release sequence (see RELEASING.md):\n` +
          `  1. npm run build:lib && npm run publish:lib      (publishes ${PALETTE_VERSION})\n` +
          `  2. bump mcp/package.json to ^${PALETTE_VERSION}, npm install in mcp/, redeploy\n` +
          `  3. npm run freeze:benchmark                      (on main)\n` +
          `  4. update the engine-version string in the discovery generator (on main)\n`
      );
    }
  });

  it("agrees with the root package version", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.version).toBe(PALETTE_VERSION);
  });
});

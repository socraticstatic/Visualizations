/**
 * Every paid feature is enforced where the work happens.
 *
 * gate.ts says out loud what it is for: "the check lives where the work
 * happens, not only on a disabled button, so it is not defeated by opening the
 * panel's console." The mockup command shipped enforced ONLY by a disabled
 * button - two of the three paid features had a sandbox gate and the newest
 * one did not, and nothing failed.
 *
 * Source-level because the alternative is mocking the whole Figma global to
 * assert an absence, and because the failure mode is somebody adding a fourth
 * paid feature and forgetting again.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PAID_FEATURES } from "../shared/license";

const read = (f: string) => readFileSync(join(__dirname, f), "utf8");
const main = read("main.ts");
const codegen = read("codegen.ts");

/** The body of one `case "x": { ... }` block in the message switch. */
function caseBody(src: string, name: string): string {
  const start = src.indexOf(`case "${name}": {`);
  if (start < 0) return "";
  const end = src.indexOf("\n        case ", start + 1);
  return src.slice(start, end < 0 ? src.length : end);
}

/** Where each paid feature is actually performed. */
const ENFORCEMENT: Record<string, () => string> = {
  "write-variables": () => caseBody(main, "write-variables"),
  mockup: () => caseBody(main, "insert-mockup"),
  codegen: () => codegen,
};

describe("paid feature enforcement", () => {
  it("covers every feature the licence claims to sell", () => {
    for (const f of PAID_FEATURES) {
      expect(Object.keys(ENFORCEMENT), `${f} has no known enforcement point`).toContain(f);
    }
  });

  it("checks the licence in the sandbox, not just the panel", () => {
    for (const f of PAID_FEATURES) {
      const body = ENFORCEMENT[f]();
      expect(body.length, `${f}: enforcement site not found in source`).toBeGreaterThan(0);
      expect(body, `${f} is not gated in the sandbox`).toContain("checkLicense");
    }
  });

  it("says why, in the idiom of its own surface", () => {
    // The message handler answers with the protocol's `unlicensed` reason.
    // Dev Mode codegen cannot - it is a different Figma API that returns a
    // result panel - so it says so in the panel instead. Asserting one idiom
    // across both surfaces failed the codegen path, which was correct all
    // along; the test was wrong, not the code.
    for (const f of PAID_FEATURES) {
      expect(ENFORCEMENT[f](), `${f} fails the gate without telling anyone`).toMatch(
        /unlicensed|needs a licence/i
      );
    }
  });
});

/**
 * The crypto path is tested against a real keypair generated per run, so this
 * proves the verifier accepts genuine keys and rejects tampered ones, not just
 * that the parser splits strings.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  parseLicense,
  verifyLicense,
  isExpired,
  isUnlocked,
  LICENSE_COPY,
  PAID_FEATURES,
  type LicensePayload,
} from "./license";

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let secret: Uint8Array;
let publicB64: string;

function issue(payload: LicensePayload, signWith: Uint8Array = secret): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const sig = p256.sign(sha256(bytes), signWith);
  return `CCS1.${b64url(bytes)}.${b64url(sig)}`;
}

const NOW = 1_800_000_000;
const valid: LicensePayload = { sub: "micah@example.com", plan: "pro", iat: NOW - 100 };

beforeAll(() => {
  secret = p256.utils.randomSecretKey();
  publicB64 = b64url(p256.getPublicKey(secret, false));
});

describe("parseLicense", () => {
  it("rejects empty and whitespace", () => {
    expect(parseLicense("")).toBe("empty");
    expect(parseLicense("   \n ")).toBe("empty");
  });

  it("rejects the wrong shape and the wrong version", () => {
    expect(parseLicense("not-a-key")).toBe("wrong-format");
    expect(parseLicense("a.b")).toBe("wrong-format");
    expect(parseLicense("CCS9.aaaa.bbbb")).toBe("wrong-version");
  });

  it("rejects payloads that are not licences", () => {
    const junk = b64url(new TextEncoder().encode(JSON.stringify({ hello: 1 })));
    expect(parseLicense(`CCS1.${junk}.AAAA`)).toBe("malformed-payload");
  });

  it("tolerates whitespace inside a pasted key", async () => {
    const key = issue(valid);
    const mangled = key.slice(0, 20) + "\n  " + key.slice(20);
    expect(typeof parseLicense(mangled)).not.toBe("string");
  });
});

describe("verifyLicense", () => {
  it("accepts a genuine key and returns who it belongs to", async () => {
    const res = await verifyLicense(issue(valid), publicB64, NOW);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.payload.sub).toBe("micah@example.com");
  });

  it("rejects a key signed by a different keypair", async () => {
    const other = p256.utils.randomSecretKey();
    const res = await verifyLicense(issue(valid, other), publicB64, NOW);
    expect(res).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a payload edited after signing", async () => {
    const key = issue(valid);
    const [v, , sig] = key.split(".");
    const tampered = b64url(new TextEncoder().encode(JSON.stringify({ ...valid, plan: "enterprise" })));
    const res = await verifyLicense(`${v}.${tampered}.${sig}`, publicB64, NOW);
    expect(res).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("reports forgery rather than expiry when a key is both", async () => {
    const other = p256.utils.randomSecretKey();
    const stale = { ...valid, exp: NOW - 1 };
    const res = await verifyLicense(issue(stale, other), publicB64, NOW);
    expect(res).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a genuine key past its expiry", async () => {
    const res = await verifyLicense(issue({ ...valid, exp: NOW - 1 }), publicB64, NOW);
    expect(res).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts a genuine key before its expiry", async () => {
    const res = await verifyLicense(issue({ ...valid, exp: NOW + 86400 }), publicB64, NOW);
    expect(res.ok).toBe(true);
  });

  it("distinguishes a missing key from an unreadable one", async () => {
    expect(await verifyLicense(issue(valid), "REPLACE_WITH_PUBLIC_KEY_SPKI_BASE64", NOW))
      .toEqual({ ok: false, reason: "no-key-embedded" });
    expect(await verifyLicense(issue(valid), "aaaa", NOW))
      .toEqual({ ok: false, reason: "key-unreadable" });
  });

  it("has human copy for every failure, with no em dashes", () => {
    for (const copy of Object.values(LICENSE_COPY)) {
      expect(copy).toBeTruthy();
      expect(copy).not.toContain("—");
    }
  });
});

describe("isExpired", () => {
  it("treats a licence with no expiry as perpetual", () => {
    expect(isExpired(valid, NOW + 10_000_000)).toBe(false);
  });
});

describe("isUnlocked", () => {
  it("keeps reading and proving free", () => {
    for (const f of ["audit", "simulate", "preview"] as const) {
      expect(isUnlocked(f, null)).toBe(true);
    }
  });

  it("gates producing behind a verified licence", async () => {
    const good = await verifyLicense(issue(valid), publicB64, NOW);
    for (const f of PAID_FEATURES) {
      expect(isUnlocked(f, null)).toBe(false);
      expect(isUnlocked(f, { ok: false, reason: "expired" })).toBe(false);
      expect(isUnlocked(f, good)).toBe(true);
    }
  });
});

describe("runs without browser globals", () => {
  /**
   * This module runs in the plugin iframe AND the sandbox. The sandbox has no
   * atob, no TextDecoder and no crypto.subtle. Each of those was found the hard
   * way, one build at a time, by a licence that verified in the panel and was
   * rejected where the work happens. Stripping them here is cheaper than
   * finding the fourth one in Figma.
   */
  const GLOBALS = ["atob", "btoa", "TextDecoder", "TextEncoder", "crypto"] as const;

  it("verifies a genuine key with every browser global removed", async () => {
    const key = issue(valid);
    const saved: Record<string, unknown> = {};
    for (const g of GLOBALS) {
      saved[g] = (globalThis as any)[g];
      delete (globalThis as any)[g];
    }
    try {
      const res = await verifyLicense(key, publicB64, NOW);
      expect(res.ok).toBe(true);
    } finally {
      for (const g of GLOBALS) (globalThis as any)[g] = saved[g];
    }
  });

  it("still rejects a forged key with every browser global removed", async () => {
    const other = p256.utils.randomSecretKey();
    const key = issue(valid, other);
    const saved: Record<string, unknown> = {};
    for (const g of GLOBALS) {
      saved[g] = (globalThis as any)[g];
      delete (globalThis as any)[g];
    }
    try {
      expect((await verifyLicense(key, publicB64, NOW)).ok).toBe(false);
    } finally {
      for (const g of GLOBALS) (globalThis as any)[g] = saved[g];
    }
  });

  it("rejects characters outside the alphabet", () => {
    expect(parseLicense("CCS1.!!!!.####")).toBe("malformed-payload");
  });
});

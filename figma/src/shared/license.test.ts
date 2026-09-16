/**
 * The crypto path is tested against a real keypair generated per run, so this
 * proves the verifier accepts genuine keys and rejects tampered ones, not just
 * that the parser splits strings.
 */
import { describe, it, expect, beforeAll } from "vitest";
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

let keys: CryptoKeyPair;
let publicB64: string;

async function issue(payload: LicensePayload, signWith: CryptoKey = keys.privateKey): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signWith, bytes as unknown as ArrayBuffer)
  );
  return `CCS1.${b64url(bytes)}.${b64url(sig)}`;
}

const NOW = 1_800_000_000;
const valid: LicensePayload = { sub: "micah@example.com", plan: "pro", iat: NOW - 100 };

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  publicB64 = b64url(new Uint8Array(await crypto.subtle.exportKey("spki", keys.publicKey)));
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
    const key = await issue(valid);
    const mangled = key.slice(0, 20) + "\n  " + key.slice(20);
    expect(typeof parseLicense(mangled)).not.toBe("string");
  });
});

describe("verifyLicense", () => {
  it("accepts a genuine key and returns who it belongs to", async () => {
    const res = await verifyLicense(await issue(valid), publicB64, NOW);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.payload.sub).toBe("micah@example.com");
  });

  it("rejects a key signed by a different keypair", async () => {
    const other = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const res = await verifyLicense(await issue(valid, other.privateKey), publicB64, NOW);
    expect(res).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a payload edited after signing", async () => {
    const key = await issue(valid);
    const [v, , sig] = key.split(".");
    const tampered = b64url(new TextEncoder().encode(JSON.stringify({ ...valid, plan: "enterprise" })));
    const res = await verifyLicense(`${v}.${tampered}.${sig}`, publicB64, NOW);
    expect(res).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("reports forgery rather than expiry when a key is both", async () => {
    const other = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const stale = { ...valid, exp: NOW - 1 };
    const res = await verifyLicense(await issue(stale, other.privateKey), publicB64, NOW);
    expect(res).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a genuine key past its expiry", async () => {
    const res = await verifyLicense(await issue({ ...valid, exp: NOW - 1 }), publicB64, NOW);
    expect(res).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts a genuine key before its expiry", async () => {
    const res = await verifyLicense(await issue({ ...valid, exp: NOW + 86400 }), publicB64, NOW);
    expect(res.ok).toBe(true);
  });

  it("says so plainly when the build has no key embedded", async () => {
    const res = await verifyLicense(await issue(valid), "REPLACE_WITH_PUBLIC_KEY_SPKI_BASE64", NOW);
    expect(res).toEqual({ ok: false, reason: "not-configured" });
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
    const good = await verifyLicense(await issue(valid), publicB64, NOW);
    for (const f of PAID_FEATURES) {
      expect(isUnlocked(f, null)).toBe(false);
      expect(isUnlocked(f, { ok: false, reason: "expired" })).toBe(false);
      expect(isUnlocked(f, good)).toBe(true);
    }
  });
});

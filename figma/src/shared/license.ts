/**
 * Offline licence verification.
 *
 * A paid plugin normally validates by calling a licence server, which would
 * force this manifest to declare a network domain and would let the plugin
 * transmit while it has a file open. That trade is refused here. Keys are
 * signed once at issue time and verified in-plugin against an embedded public
 * key, so the plugin can be paid for and still declare allowedDomains: none.
 * It cannot phone home because it has nowhere to phone.
 *
 * ECDSA P-256, verified with a pure-JS implementation rather than WebCrypto.
 * This started on crypto.subtle and could never have worked: a Figma plugin
 * iframe runs at a null origin, which is not a secure context, so subtle is
 * undefined there. Every unit test passed because Node has it. Running the
 * plugin is what found this. @noble/curves needs no secure context and works
 * in the sandbox and the iframe alike.
 *
 * The public key is the raw uncompressed point, not SPKI, because that is what
 * a curve library consumes directly.
 *
 * Key shape: CCS1.<base64url payload>.<base64url signature>
 */

export const LICENSE_PREFIX = "CCS1";

/** Replace with the public half of the signing key before publishing. */
export const PUBLIC_KEY_SPKI_B64 =
  "BOmaNShhzFsOaTcGDSjDoImYh2bNioww1RbGSBNZXe-bksDZXmgDnymf6VBGqPlkhHMo3HxzzAhulYFwKNvDFUc";

export interface LicensePayload {
  /** Who it was issued to. Shown back to the user so a key is identifiable. */
  sub: string;
  plan: string;
  /** Issued at, seconds since epoch. */
  iat: number;
  /** Optional expiry, seconds since epoch. */
  exp?: number;
}

export type LicenseFailure =
  | "empty"
  | "wrong-format"
  | "wrong-version"
  | "malformed-payload"
  | "bad-signature"
  | "expired"
  | "no-key-embedded"
  | "key-unreadable"
  | "crypto-unavailable";

export type LicenseStatus =
  | { ok: true; payload: LicensePayload }
  | { ok: false; reason: LicenseFailure };

export const LICENSE_COPY: Record<LicenseFailure, string> = {
  empty: "Paste the licence key from your purchase email.",
  "wrong-format": "That does not look like a licence key. It has three parts separated by dots.",
  "wrong-version": "That key was issued for a different version of this plugin.",
  "malformed-payload": "That key is damaged. Copy it again from your purchase email, whole.",
  "bad-signature": "That key did not verify. Check it copied completely, including the last characters.",
  expired: "That licence has expired.",
  "no-key-embedded": "This build has no signing key embedded, so licences cannot be checked.",
  "key-unreadable": "This build's signing key is malformed, so licences cannot be checked.",
  "crypto-unavailable":
    "This Figma build does not expose the cryptography needed to check a licence key here.",
};

import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Decoded by hand rather than with atob.
 *
 * atob exists in the plugin iframe and not in the sandbox, so a licence that
 * verified in the panel was rejected where the work happens. Both halves need
 * this, so it depends on no host global.
 */
function b64urlToBytes(s: string): Uint8Array | null {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(norm)) return null;

  const clean = norm.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let i = 0;

  for (const ch of clean) {
    const v = B64_ALPHABET.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[i++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, i);
}

/**
 * UTF-8 decoded by hand, for the same reason as the base64: TextDecoder is a
 * browser global and the sandbox does not have one. Licence payloads are JSON,
 * so this covers the full range rather than assuming ASCII.
 */
function utf8Decode(bytes: Uint8Array): string | null {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    let cp: number;
    if (b < 0x80) cp = b;
    else if (b >= 0xc2 && b <= 0xdf) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    else if (b >= 0xe0 && b <= 0xef)
      cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else if (b >= 0xf0 && b <= 0xf4)
      cp =
        ((b & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
    else return null;
    if (!Number.isFinite(cp) || cp < 0) return null;
    out += String.fromCodePoint(cp);
  }
  return out;
}

export interface ParsedLicense {
  payload: LicensePayload;
  signature: Uint8Array;
  /** The exact bytes that were signed: the payload segment as transmitted. */
  signed: Uint8Array;
}

/** Structure and dates only. No cryptography, so it is cheap and testable. */
export function parseLicense(raw: string): ParsedLicense | LicenseFailure {
  const key = raw.trim().replace(/\s+/g, "");
  if (!key) return "empty";

  const parts = key.split(".");
  if (parts.length !== 3) return "wrong-format";
  const [version, payloadSeg, sigSeg] = parts;
  if (version !== LICENSE_PREFIX) return "wrong-version";

  const payloadBytes = b64urlToBytes(payloadSeg);
  const signature = b64urlToBytes(sigSeg);
  if (!payloadBytes || !signature) return "malformed-payload";

  const json = utf8Decode(payloadBytes);
  if (json === null) return "malformed-payload";

  let payload: LicensePayload;
  try {
    payload = JSON.parse(json);
  } catch {
    return "malformed-payload";
  }

  if (typeof payload?.sub !== "string" || typeof payload?.plan !== "string" || typeof payload?.iat !== "number") {
    return "malformed-payload";
  }

  return { payload, signature, signed: payloadBytes };
}

export function isExpired(payload: LicensePayload, nowSeconds: number): boolean {
  return typeof payload.exp === "number" && payload.exp < nowSeconds;
}

/**
 * Full check. Returns rather than throws, so every caller has to handle the
 * reason instead of letting a catch-all swallow it.
 */
export async function verifyLicense(
  raw: string,
  publicKeyB64: string = PUBLIC_KEY_SPKI_B64,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<LicenseStatus> {
  const parsed = parseLicense(raw);
  if (typeof parsed === "string") return { ok: false, reason: parsed };

  if (publicKeyB64.startsWith("REPLACE_WITH")) return { ok: false, reason: "no-key-embedded" };

  const pub = b64urlToBytes(publicKeyB64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  if (!pub || pub.length < 33) return { ok: false, reason: "key-unreadable" };

  let good = false;
  try {
    good = p256.verify(parsed.signature, sha256(parsed.signed), pub);
  } catch {
    return { ok: false, reason: "bad-signature" };
  }
  if (!good) return { ok: false, reason: "bad-signature" };

  // Expiry is checked only after the signature, so an expired-but-forged key
  // reports the forgery rather than teaching an attacker which field to change.
  if (isExpired(parsed.payload, nowSeconds)) return { ok: false, reason: "expired" };

  return { ok: true, payload: parsed.payload };
}

/** What a licence unlocks. Reading and proving stay free; producing is paid. */
export const PAID_FEATURES = ["write-variables", "codegen", "mockup"] as const;
export type Feature = (typeof PAID_FEATURES)[number] | "audit" | "simulate" | "preview";

export function isUnlocked(feature: Feature, status: LicenseStatus | null): boolean {
  if (!(PAID_FEATURES as readonly string[]).includes(feature)) return true;
  return status?.ok === true;
}

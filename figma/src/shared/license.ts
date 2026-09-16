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
 * ECDSA P-256 rather than Ed25519: P-256 has had universal WebCrypto support
 * for years, while Ed25519 arrived only recently and Figma's runtime is a
 * Chromium the plugin does not choose. The security properties are adequate
 * either way; portability is not.
 *
 * Key shape: CCS1.<base64url payload>.<base64url signature>
 */

export const LICENSE_PREFIX = "CCS1";

/** Replace with the public half of the signing key before publishing. */
export const PUBLIC_KEY_SPKI_B64 = "REPLACE_WITH_PUBLIC_KEY_SPKI_BASE64";

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
  | "not-configured";

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
  "not-configured": "This build has no signing key embedded, so licences cannot be checked.",
};

function b64urlToBytes(s: string): Uint8Array | null {
  try {
    const pad = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
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

  let payload: LicensePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
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

  const spki = b64urlToBytes(publicKeyB64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  if (!spki || spki.length < 16) return { ok: false, reason: "not-configured" };

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "spki",
      spki as unknown as ArrayBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
  } catch {
    return { ok: false, reason: "not-configured" };
  }

  let good = false;
  try {
    good = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      parsed.signature as unknown as ArrayBuffer,
      parsed.signed as unknown as ArrayBuffer
    );
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

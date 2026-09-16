#!/usr/bin/env node
/**
 * Licence key tooling. Offline, no service, no accounts.
 *
 *   node scripts/license.mjs keygen
 *   node scripts/license.mjs issue <privateKeyB64> <email> [plan] [daysValid]
 *
 * Signing and verification both use @noble/curves. They used to differ, with
 * WebCrypto here and noble in the plugin, and the two did not interoperate at
 * matching byte lengths. One implementation on both sides removes the question.
 *
 * The private key never enters the plugin, and the plugin never contacts
 * anything. A key is a signed statement, not a session.
 */
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));

function keygen() {
  const priv = p256.utils.randomSecretKey();
  const pub = p256.getPublicKey(priv, false); // uncompressed point
  console.log("PUBLIC  (paste into src/shared/license.ts as PUBLIC_KEY_SPKI_B64):\n" + b64url(pub));
  console.log("\nPRIVATE (keep out of this repository, it is the only thing stopping forgery):\n" + b64url(priv));
}

function issue(privB64, sub, plan = "pro", days = "") {
  if (!privB64 || !sub) {
    console.error("usage: license.mjs issue <privateKeyB64> <email> [plan] [daysValid]");
    process.exit(1);
  }
  const iat = Math.floor(Date.now() / 1000);
  const payload = { sub, plan, iat };
  if (days) payload.exp = iat + Number(days) * 86400;

  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const sig = p256.sign(sha256(bytes), fromB64url(privB64));
  console.log(`CCS1.${b64url(bytes)}.${b64url(sig)}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "keygen") keygen();
else if (cmd === "issue") issue(...rest);
else {
  console.error("usage: license.mjs keygen | issue <privateKeyB64> <email> [plan] [daysValid]");
  process.exit(1);
}

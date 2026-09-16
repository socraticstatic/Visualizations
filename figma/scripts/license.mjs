#!/usr/bin/env node
/**
 * Licence key tooling. Offline, no service, no accounts.
 *
 *   node scripts/license.mjs keygen
 *       Prints a new keypair. The public half goes into src/shared/license.ts;
 *       the private half goes somewhere that is not this repository.
 *
 *   node scripts/license.mjs issue <privateKeyB64> <email> [plan] [daysValid]
 *       Prints a licence key to send to a buyer.
 *
 * The private key never enters the plugin, and the plugin never contacts
 * anything. A key is a signed statement, not a session.
 */
const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

const ALG = { name: "ECDSA", namedCurve: "P-256" };
const SIGN = { name: "ECDSA", hash: "SHA-256" };

async function keygen() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
  const pub = b64url(await crypto.subtle.exportKey("spki", publicKey));
  const priv = b64url(await crypto.subtle.exportKey("pkcs8", privateKey));
  console.log("PUBLIC  (paste into src/shared/license.ts as PUBLIC_KEY_SPKI_B64):\n" + pub);
  console.log("\nPRIVATE (keep out of this repository, it is the only thing stopping forgery):\n" + priv);
}

async function issue(privB64, sub, plan = "pro", days = "") {
  if (!privB64 || !sub) {
    console.error("usage: license.mjs issue <privateKeyB64> <email> [plan] [daysValid]");
    process.exit(1);
  }
  const key = await crypto.subtle.importKey("pkcs8", fromB64url(privB64), ALG, false, ["sign"]);
  const iat = Math.floor(Date.now() / 1000);
  const payload = { sub, plan, iat };
  if (days) payload.exp = iat + Number(days) * 86400;

  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  const sig = await crypto.subtle.sign(SIGN, key, bytes);
  console.log(`CCS1.${b64url(bytes)}.${b64url(sig)}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "keygen") await keygen();
else if (cmd === "issue") await issue(...rest);
else {
  console.error("usage: license.mjs keygen | issue <privateKeyB64> <email> [plan] [daysValid]");
  process.exit(1);
}

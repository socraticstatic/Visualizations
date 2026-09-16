/**
 * Paid-feature gate, sandbox side.
 *
 * Be clear about what this is. A published plugin's code.js and ui.html are
 * readable by anyone who installs it, so a determined person can patch either
 * layer and get the paid features. Client-side licensing is a payment
 * convention, not DRM, and the cryptography here prevents forging a key rather
 * than bypassing the check.
 *
 * What it does buy: the check lives where the work happens, not only on a
 * disabled button, so it is not defeated by opening the panel's console. The
 * signature is verified in the UI, which has WebCrypto; this side re-checks
 * that a key is present, well-formed and unexpired before touching the file.
 */
import { parseLicense, isExpired, verifyLicense } from "../shared/license";

const STORE_KEY = "chart-color-system:panel";

/**
 * WebCrypto is documented for the plugin iframe. Whether the sandbox has it is
 * not documented either way, so it is detected rather than assumed. When it is
 * present the signature is checked here too and a forged key fails on both
 * sides; when it is absent this falls back to structure and expiry, which a
 * forged key would pass. The fallback is the weaker claim and is named as such.
 */
export function sandboxCanVerifySignatures(): boolean {
  return typeof crypto !== "undefined" && typeof crypto?.subtle?.importKey === "function";
}

export async function hasLicense(): Promise<boolean> {
  try {
    const raw = (await figma.clientStorage.getAsync(STORE_KEY)) as Record<string, string> | undefined;
    const key = raw?.license;
    if (!key) return false;

    if (sandboxCanVerifySignatures()) {
      return (await verifyLicense(key)).ok;
    }

    const parsed = parseLicense(key);
    if (typeof parsed === "string") return false;
    return !isExpired(parsed.payload, Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

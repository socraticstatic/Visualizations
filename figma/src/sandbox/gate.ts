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
import { parseLicense, isExpired } from "../shared/license";

const STORE_KEY = "chart-color-system:panel";

export async function hasLicense(): Promise<boolean> {
  try {
    const raw = (await figma.clientStorage.getAsync(STORE_KEY)) as Record<string, string> | undefined;
    const key = raw?.license;
    if (!key) return false;
    const parsed = parseLicense(key);
    if (typeof parsed === "string") return false;
    return !isExpired(parsed.payload, Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

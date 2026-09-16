import { useCallback, useEffect, useState } from "react";
import { verifyLicense, type LicenseStatus } from "../shared/license";
import { send } from "./bridge";

const KEY = "license";

/**
 * The licence lives in clientStorage on this machine. It is never transmitted,
 * because there is nowhere to transmit it to.
 */
export function useLicense() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await send({ type: "store-get" });
      const stored = res.ok && res.type === "store" ? res.payload[KEY] : undefined;
      if (!stored) {
        if (!cancelled) setChecking(false);
        return;
      }
      const verified = await verifyLicense(stored);
      if (!cancelled) {
        setStatus(verified);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activate = useCallback(async (raw: string): Promise<LicenseStatus> => {
    const verified = await verifyLicense(raw);
    setStatus(verified);
    if (verified.ok) {
      const stored = await send({ type: "store-set", key: KEY, value: raw.trim() });
      setStorageWarning(stored.ok ? null : stored.detail);
    }
    return verified;
  }, []);

  return { status, checking, activate, storageWarning };
}

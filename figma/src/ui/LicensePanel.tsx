import { useState } from "react";
import { LICENSE_COPY, type LicenseStatus } from "../shared/license";

export function LicensePanel({
  status,
  activate,
  storageWarning,
}: {
  status: LicenseStatus | null;
  activate: (raw: string) => Promise<LicenseStatus>;
  storageWarning?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  if (status?.ok) {
    return (
      <div className="licence licence--ok">
        <p style={{ margin: 0 }}>
          Licensed to <strong>{status.payload.sub}</strong>
          {status.payload.exp ? ` until ${new Date(status.payload.exp * 1000).toISOString().slice(0, 10)}` : ""}.
        </p>
        {storageWarning && <p className="licence__error">{storageWarning}</p>}
      </div>
    );
  }

  return (
    <div className="licence">
      {!open ? (
        <button className="btn btn--quiet" onClick={() => setOpen(true)}>
          Enter licence key
        </button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await activate(value);
            setBusy(false);
          }}
        >
          <label className="field">
            <span className="field__label">Licence key</span>
            <textarea
              className="licence__input"
              rows={3}
              spellCheck={false}
              value={value}
              placeholder="CCS1...."
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <button className="btn" type="submit" disabled={busy || !value.trim()}>
            {busy ? "Checking" : "Activate"}
          </button>
        </form>
      )}
      {status && !status.ok && <p className="licence__error">{LICENSE_COPY[status.reason]}</p>}
    </div>
  );
}

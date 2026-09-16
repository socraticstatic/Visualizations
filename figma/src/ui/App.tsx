import { useEffect, useState } from "react";
import { PALETTE_VERSION } from "@engine/version";
import { GenerateTab } from "./GenerateTab";
import { AuditTab } from "./AuditTab";
import { SimulateTab } from "./SimulateTab";
import { LicensePanel } from "./LicensePanel";
import { useLicense } from "./useLicense";
import { send } from "./bridge";

type Tab = "generate" | "audit" | "simulate";

const TABS: Array<{ id: Tab; label: string; blurb: string }> = [
  {
    id: "generate",
    label: "Generate",
    blurb:
      "Solve an audited palette against the background your chart actually sits on, then write it into this file as variables.",
  },
  {
    id: "audit",
    label: "Audit",
    blurb:
      "Measure the colours already in your selection for contrast and colour-vision deficiency, and say plainly which ones cannot be measured.",
  },
  {
    id: "simulate",
    label: "Simulate",
    blurb:
      "Copy the selection once per vision type so the failure is something you look at rather than read about.",
  },
];

export function App() {
  const [tab, setTab] = useState<Tab>("generate");
  const [scheme, setScheme] = useState<"light" | "dark">(() =>
    typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  );

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setScheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage;
      if (msg?.type === "open" && TABS.some((t) => t.id === msg.tab)) setTab(msg.tab as Tab);
    };
    window.addEventListener("message", onMessage);

    // The sandbox posts the launch tab immediately, which races this listener
    // being attached, so every command landed on Generate. Ask for it instead.
    void send({ type: "read-command" }).then((res) => {
      if (res.ok && res.type === "command" && TABS.some((t) => t.id === res.payload)) {
        setTab(res.payload);
      }
    });

    return () => window.removeEventListener("message", onMessage);
  }, []);

  const { status: license, activate, storageWarning } = useLicense();

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="panel">
      <header className="panel__head">
        <h1 className="panel__title">Chart Color System</h1>
        <span className="panel__version num">v{PALETTE_VERSION}</span>
      </header>

      <div className="tabs" role="tablist" aria-label="Plugin commands">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="tab"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main
        className="panel__body"
        role="tabpanel"
        id={`panel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
      >
        {tab === "generate" && <GenerateTab theme={scheme} license={license} />}
        {tab === "audit" && <AuditTab />}
        {tab === "simulate" && <SimulateTab />}
        <LicensePanel status={license} activate={activate} storageWarning={storageWarning} />
      </main>
    </div>
  );
}

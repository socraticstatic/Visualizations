import { useEffect, useRef, useState } from "react";
import { PALETTE_VERSION } from "@engine/version";
import { GenerateTab } from "./GenerateTab";
import { AuditTab } from "./AuditTab";
import { SimulateTab } from "./SimulateTab";
import { MockupTab } from "./MockupTab";
import { LicensePanel } from "./LicensePanel";
import { useLicense } from "./useLicense";
import { send } from "./bridge";

import type { Tab } from "../shared/protocol";

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
    id: "mockup",
    label: "Mockup",
    blurb:
      "Put a chart on the canvas with the palette already audited, and the verdict, the relaxations and the missing decal layer written into the frame.",
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

  /**
   * Ask Figma for exactly the height this panel needs.
   *
   * The window was a fixed 720 and the body scrolled inside it, so short tabs
   * left dead space and long ones hid their own controls behind a scrollbar.
   * A ResizeObserver on the content reports the real height after every
   * render, tab change and solve.
   */
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver !== "function") return;
    let last = 0;
    const push = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      // A pixel of jitter would ping-pong with Figma's own rounding.
      if (Math.abs(h - last) < 4) return;
      last = h;
      void send({ type: "resize", height: h });
    };
    const ro = new ResizeObserver(push);
    ro.observe(el);
    push();
    return () => ro.disconnect();
  }, []);

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="panel" ref={bodyRef}>
      <div className="panel__top">
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
        <span className="panel__version num">v{PALETTE_VERSION}</span>
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
        {tab === "mockup" && <MockupTab theme={scheme} license={license} />}
        <LicensePanel status={license} activate={activate} storageWarning={storageWarning} />
      </main>
    </div>
  );
}

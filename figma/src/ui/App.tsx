import { useEffect, useState } from "react";

export function App() {
  const [tab, setTab] = useState<string>("generate");

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage;
      if (msg?.type === "open") setTab(msg.tab);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 12, padding: 12 }}>
      <h1 style={{ fontSize: 13, margin: "0 0 8px" }}>Chart Color System</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>Opened on the {tab} tab. Nothing is wired up yet.</p>
    </main>
  );
}

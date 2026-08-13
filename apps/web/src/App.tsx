import { useState } from "react";
import { CampaignBuilder } from "./components/CampaignBuilder";
import { HealthPanel } from "./components/HealthPanel";
import { LeadsPanel } from "./components/LeadsPanel";

export function App() {
  const [tab, setTab] = useState<"dashboard" | "builder" | "leads">("dashboard");

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Growth OS — Fase 3 (design/simulação)</h1>
      <nav>
        <button onClick={() => setTab("dashboard")}>Dashboard</button>
        <button onClick={() => setTab("builder")}>Builder</button>
        <button onClick={() => setTab("leads")}>Leads & Suppression</button>
      </nav>
      {tab === "dashboard" ? <HealthPanel /> : tab === "builder" ? <CampaignBuilder /> : <LeadsPanel />}
    </main>
  );
}

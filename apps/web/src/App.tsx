import { useState } from "react";
import { CampaignBuilder } from "./components/CampaignBuilder";
import { HealthPanel } from "./components/HealthPanel";

export function App() {
  const [tab, setTab] = useState<"dashboard" | "builder">("dashboard");

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Growth OS — Fase 2 (design/simulação)</h1>
      <nav>
        <button onClick={() => setTab("dashboard")}>Dashboard</button>
        <button onClick={() => setTab("builder")}>Builder</button>
      </nav>
      {tab === "dashboard" ? <HealthPanel /> : <CampaignBuilder />}
    </main>
  );
}

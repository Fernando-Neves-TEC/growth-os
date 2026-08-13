/** Cliente de demonstração: inicia um workflow `campaignRun` no Temporal local. */
import { Client, Connection } from "@temporalio/client";
import type { Workflow } from "@growthos/core";
import type { CampaignRunInput } from "./workflows/campaign.js";

const validWorkflow: Workflow = {
  id: "wf-demo",
  version: 1,
  name: "funil demo",
  entry: "s1",
  nodes: [
    { id: "s1", type: "send", config: { channel: "whatsapp", body: "Olá!" } },
    { id: "e", type: "end" },
  ],
  edges: [{ from: "s1", to: "e" }],
};

/** Workflow inválido (entry inexistente) para exercitar o diagnóstico validationErrors. */
const invalidWorkflow: Workflow = {
  id: "wf-invalid",
  version: 1,
  name: "funil inválido",
  entry: "nao-existe",
  nodes: [{ id: "s", type: "send", config: { channel: "whatsapp", body: "oi" } }],
  edges: [],
};

async function run(): Promise<void> {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  });
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
  });

  const input: CampaignRunInput = {
    campaignId: "demo-001",
    workflow: process.env.WORKFLOW_INVALID === "1" ? invalidWorkflow : validWorkflow,
    plans: Array.from({ length: 8 }, (_, i) => ({
      leadId: `lead-${i}`,
      // lead-0 usa um CNPJ supostamente em suppression (para provar o filtro no workflow)
      cnpj: i === 0 ? "11122233000111" : `111222330001${String(i).padStart(2, "0")}`,
      channel: "whatsapp" as const,
      body: `Abordagem demo ${i}`,
    })),
  };

  const handle = await client.workflow.start("campaignRun", {
    taskQueue: "growthos-campaign",
    workflowId: `growthos-demo-${Date.now()}`,
    args: [input],
  });

  console.log(`[start] workflow ${handle.workflowId} iniciado.`);
  const result = await handle.result();
  console.log("[start] resultado:", JSON.stringify(result, null, 2));
}

run().catch((err) => {
  console.error("[start] erro:", err);
  process.exit(1);
});

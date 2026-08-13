/** Workflow de campanha (Temporal) — Fase 2/3.

Execução real com fail-closed:
1. valida o workflow (core) — diagnóstico estruturado se inválido;
2. consulta o kill-switch (activity → API) e para se pausado;
3. para cada lead: verifica suppression (activity → API) antes de qualquer envio;
4. envia (activity mock com retry) e registra eventos (activity → API), idempotentes por eventId.
*/
import { proxyActivities } from "@temporalio/workflow";
import { validateWorkflow, type Workflow } from "@growthos/core";
import type {
  EventPayload,
  KillSwitchState,
  SendResult,
  SuppressionCheck,
} from "../activities/api.js";

export interface PlanItem {
  leadId: string;
  cnpj?: string;
  channel: "whatsapp" | "email";
  body: string;
}

export interface CampaignRunInput {
  campaignId: string;
  workflow: Workflow;
  plans: PlanItem[];
}

export interface DispatchResult {
  leadId: string;
  delivered: boolean;
  read: boolean;
  replied: boolean;
  suppressed?: boolean;
}

export interface CampaignRunResult {
  campaignId: string;
  workflowValid: boolean;
  validationErrors?: string[];
  paused?: boolean;
  dispatched: number;
  results: DispatchResult[];
}

export interface Activities {
  getKillSwitch(): Promise<KillSwitchState>;
  isSuppressed(cnpj: string): Promise<SuppressionCheck>;
  sendMessage(plan: PlanItem): Promise<SendResult>;
  recordEvent(event: EventPayload): Promise<{ duplicate: boolean }>;
}

const { getKillSwitch, isSuppressed, sendMessage, recordEvent } = proxyActivities<Activities>({
  startToCloseTimeout: "30 seconds",
  retry: { initialInterval: "1s", backoffCoefficient: 2, maximumAttempts: 5 },
});

export async function campaignRun(input: CampaignRunInput): Promise<CampaignRunResult> {
  // Validação pura do core (fail-closed antes de despachar).
  const validated = validateWorkflow(input.workflow);
  if (!validated.ok) {
    return {
      campaignId: input.campaignId,
      workflowValid: false,
      validationErrors: validated.error,
      dispatched: 0,
      results: [],
    };
  }

  // Kill-switch aplicado em todos os caminhos de execução.
  const ks = await getKillSwitch();
  if (ks.paused) {
    return { campaignId: input.campaignId, workflowValid: true, paused: true, dispatched: 0, results: [] };
  }

  const results: DispatchResult[] = [];
  let dispatched = 0;
  for (const plan of input.plans) {
    // Suppression aplicada antes de qualquer envio.
    if (plan.cnpj) {
      const sup = await isSuppressed(plan.cnpj);
      if (sup.suppressed) {
        results.push({ leadId: plan.leadId, delivered: false, read: false, replied: false, suppressed: true });
        continue;
      }
    }

    const r = await sendMessage(plan); // retries configurados
    await recordEvent({ eventId: `wf-${input.campaignId}-${plan.leadId}-sent`, type: "sent", cnpj: plan.cnpj, channel: plan.channel });
    if (r.delivered) {
      await recordEvent({ eventId: `wf-${input.campaignId}-${plan.leadId}-delivered`, type: "delivered", cnpj: plan.cnpj, channel: plan.channel });
    }
    if (r.read) {
      await recordEvent({ eventId: `wf-${input.campaignId}-${plan.leadId}-read`, type: "read", cnpj: plan.cnpj, channel: plan.channel });
    }
    if (r.replied) {
      await recordEvent({ eventId: `wf-${input.campaignId}-${plan.leadId}-replied`, type: "replied", cnpj: plan.cnpj, channel: plan.channel });
    }
    results.push({ leadId: plan.leadId, ...r });
    dispatched += 1;
  }

  return { campaignId: input.campaignId, workflowValid: true, dispatched, results };
}

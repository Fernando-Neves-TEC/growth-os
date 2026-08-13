/** Executor puro de campanha (Pilar 2) — compartilhado pelo workflow Temporal e por E2E determinísticos.
 *
 * Fail-closed e ponto seguro de interrupção:
 * - valida o workflow (core) antes de qualquer envio;
 * - kill-switch verificado no início E entre cada lead (interrompe novos envios quando acionado);
 * - suppression consultada por lead antes do envio;
 * - eventos gravados em ordem canônica (sent → delivered → read → replied), idempotentes por eventId.
 *
 * Nenhum I/O aqui: as activities (kill-switch/suppression/envio/eventos) são injetadas.
 */
import { validateWorkflow } from "./workflow.js";
import type { Workflow } from "./types.js";

export interface CampaignPlanItem {
  leadId: string;
  cnpj?: string;
  channel: "whatsapp" | "email";
  body: string;
}

export interface CampaignRunInput {
  campaignId: string;
  workflow: Workflow;
  plans: CampaignPlanItem[];
}

export type CampaignEventType = "sent" | "delivered" | "read" | "replied";

export interface CampaignRunActivities {
  getKillSwitch(): Promise<{ paused: boolean; reason: string | null }>;
  isSuppressed(cnpj: string): Promise<{ suppressed: boolean }>;
  sendMessage(plan: CampaignPlanItem): Promise<{ delivered: boolean; read: boolean; replied: boolean }>;
  recordEvent(event: { eventId: string; type: CampaignEventType; cnpj?: string; channel?: string }): Promise<{ duplicate: boolean }>;
}

export interface DispatchResult {
  leadId: string;
  delivered: boolean;
  read: boolean;
  replied: boolean;
  suppressed?: boolean;
}

export interface CampaignRunOutcome {
  campaignId: string;
  workflowValid: boolean;
  validationErrors?: string[];
  /** true quando a execução parou (ou nem começou) por kill-switch. */
  paused?: boolean;
  dispatched: number;
  results: DispatchResult[];
}

export async function executeCampaignRun(
  input: CampaignRunInput,
  act: CampaignRunActivities,
): Promise<CampaignRunOutcome> {
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

  // Kill-switch verificado antes do primeiro envio.
  const ks0 = await act.getKillSwitch();
  if (ks0.paused) {
    return { campaignId: input.campaignId, workflowValid: true, paused: true, dispatched: 0, results: [] };
  }

  const results: DispatchResult[] = [];
  let dispatched = 0;
  for (const plan of input.plans) {
    // PONTO SEGURO DE INTERRUPÇÃO: kill-switch é verificado antes de CADA lead —
    // campanha em execução para de enviar assim que o kill-switch é acionado.
    const ks = await act.getKillSwitch();
    if (ks.paused) {
      return { campaignId: input.campaignId, workflowValid: true, paused: true, dispatched, results };
    }

    if (plan.cnpj) {
      const sup = await act.isSuppressed(plan.cnpj);
      if (sup.suppressed) {
        results.push({ leadId: plan.leadId, delivered: false, read: false, replied: false, suppressed: true });
        continue;
      }
    }

    const r = await act.sendMessage(plan);
    await act.recordEvent({
      eventId: `wf-${input.campaignId}-${plan.leadId}-sent`,
      type: "sent",
      cnpj: plan.cnpj,
      channel: plan.channel,
    });
    if (r.delivered) {
      await act.recordEvent({
        eventId: `wf-${input.campaignId}-${plan.leadId}-delivered`,
        type: "delivered",
        cnpj: plan.cnpj,
        channel: plan.channel,
      });
    }
    if (r.read) {
      await act.recordEvent({
        eventId: `wf-${input.campaignId}-${plan.leadId}-read`,
        type: "read",
        cnpj: plan.cnpj,
        channel: plan.channel,
      });
    }
    if (r.replied) {
      await act.recordEvent({
        eventId: `wf-${input.campaignId}-${plan.leadId}-replied`,
        type: "replied",
        cnpj: plan.cnpj,
        channel: plan.channel,
      });
    }
    results.push({ leadId: plan.leadId, ...r });
    dispatched += 1;
  }

  return { campaignId: input.campaignId, workflowValid: true, dispatched, results };
}

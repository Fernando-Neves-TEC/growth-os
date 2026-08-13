/** Workflow de campanha (Temporal) — Fase 2.

Determinismo: o plano de envio é calculado no cliente (fora do workflow) e
passado como input; o workflow apenas orquestra activities (que podem ter
aleatoriedade). O core é usado apenas via funções puras (validateWorkflow).
*/
import { proxyActivities } from "@temporalio/workflow";
import { validateWorkflow, type Workflow } from "@growthos/core";

export interface PlanItem {
  leadId: string;
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
}

export interface CampaignRunResult {
  campaignId: string;
  workflowValid: boolean;
  /** Erros estruturados de validação — presentes quando workflowValid=false. */
  validationErrors?: string[];
  dispatched: number;
  results: DispatchResult[];
}

export interface SendActivity {
  sendMessage(plan: PlanItem): Promise<Omit<DispatchResult, "leadId">>;
}

const { sendMessage } = proxyActivities<SendActivity>({
  startToCloseTimeout: "30 seconds",
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

  const results: DispatchResult[] = [];
  for (const plan of input.plans) {
    const r = await sendMessage(plan);
    results.push({ leadId: plan.leadId, ...r });
  }
  return { campaignId: input.campaignId, workflowValid: true, dispatched: results.length, results };
}

/** Workflow de campanha (Temporal) — delega ao executor puro do core (executeCampaignRun).
 *  O executor aplica: validação do workflow, kill-switch no início E entre leads (ponto seguro
 *  de interrupção), suppression por lead, envio mock e eventos em ordem canônica (idempotentes).
 *  Nenhuma lógica de negócio duplicada aqui — o workflow é um adaptador fino sobre o core.
 */
import { proxyActivities } from "@temporalio/workflow";
import {
  executeCampaignRun,
  type CampaignRunActivities,
  type CampaignRunInput,
  type CampaignRunOutcome,
} from "@growthos/core";

export type { CampaignRunInput, CampaignRunOutcome };

const { getKillSwitch, isSuppressed, sendMessage, recordEvent } = proxyActivities<CampaignRunActivities>({
  startToCloseTimeout: "30 seconds",
  retry: { initialInterval: "1s", backoffCoefficient: 2, maximumAttempts: 5 },
});

export async function campaignRun(input: CampaignRunInput): Promise<CampaignRunOutcome> {
  return executeCampaignRun(input, { getKillSwitch, isSuppressed, sendMessage, recordEvent });
}


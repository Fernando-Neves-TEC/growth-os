/** Launcher de workflow de campanha.
 *  Produção inicia um workflow `campaignRun` no Temporal (C1 — API→Temporal);
 *  testes substituem por um fake determinístico que executa o executor puro do core.
 */
import { ConflictException, Injectable } from "@nestjs/common";
import { Client, Connection } from "@temporalio/client";
import type { CampaignRunInput } from "@growthos/core";

export interface WorkflowLaunch {
  workflowId: string;
}

export interface WorkflowLauncher {
  launch(input: CampaignRunInput): Promise<WorkflowLaunch>;
}

export const WORKFLOW_LAUNCHER = Symbol("WORKFLOW_LAUNCHER");

@Injectable()
export class TemporalWorkflowLauncher implements WorkflowLauncher {
  private connection?: Connection;
  private client?: Client;

  private async ensureClient(): Promise<Client> {
    if (!this.client) {
      const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
      const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
      this.connection = await Connection.connect({ address });
      this.client = new Client({ connection: this.connection, namespace });
    }
    return this.client;
  }

  /** Inicia o workflow com workflowId ESTÁVEL por campanha (protege contra início duplicado). */
  async launch(input: CampaignRunInput): Promise<WorkflowLaunch> {
    const client = await this.ensureClient();
    const workflowId = `growthos-${input.campaignId}`;
    try {
      await client.workflow.start("campaignRun", {
        taskQueue: "growthos-campaign",
        workflowId,
        args: [input],
      });
    } catch (err) {
      if (err instanceof Error && /AlreadyStarted/i.test(err.message)) {
        throw new ConflictException(`campanha ${input.campaignId} já possui workflow em execução`);
      }
      throw err;
    }
    return { workflowId };
  }
}

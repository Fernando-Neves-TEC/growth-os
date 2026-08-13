import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  ConversationStateMachine,
  Sequencer,
  validateWorkflow,
  type AntiBanPolicy,
  type CampaignPlanItem,
  type Channel,
  type ConversationEvent,
  type GrowthConfig,
  type StepResult,
} from "@growthos/core";
import { GROWTH_CONFIG } from "../config/config.module.js";
import {
  CAMPAIGN_STORE,
  KILL_SWITCH_STORE,
  type CampaignRecord,
  type CampaignStore,
  type KillSwitchStore,
} from "../persistence/stores.js";
import { WORKFLOW_LAUNCHER, type WorkflowLauncher } from "./workflow-launcher.js";

export interface CreateCampaignInput {
  name: string;
  workflow: unknown;
}

export interface PlanDayInput {
  leads: { leadId: string; channel: Channel; body: string }[];
  dayIndex?: number;
}

export interface SimulateTurnInput {
  campaignId: string;
  event: ConversationEvent;
  currentNode: string | null;
}

export interface StartCampaignInput {
  plans: CampaignPlanItem[];
}

@Injectable()
export class CampaignsService {
  constructor(
    @Inject(CAMPAIGN_STORE) private readonly campaigns: CampaignStore,
    @Inject(KILL_SWITCH_STORE) private readonly killSwitch: KillSwitchStore,
    @Inject(GROWTH_CONFIG) private readonly cfg: GrowthConfig,
    @Inject(WORKFLOW_LAUNCHER) private readonly launcher: WorkflowLauncher,
  ) {}

  async create(input: CreateCampaignInput): Promise<CampaignRecord> {
    if (!input?.name?.trim()) throw new BadRequestException("name é obrigatório");
    const validated = validateWorkflow(input.workflow);
    if (!validated.ok) {
      throw new BadRequestException({ message: "workflow inválido", errors: validated.error });
    }
    const record: CampaignRecord = {
      id: randomUUID(),
      name: input.name,
      workflow: validated.value,
      status: "draft",
    };
    await this.campaigns.create(record);
    return record;
  }

  async get(id: string): Promise<CampaignRecord> {
    const rec = await this.campaigns.get(id);
    if (!rec) throw new NotFoundException(`campanha ${id} não encontrada`);
    return rec;
  }

  async list(): Promise<CampaignRecord[]> {
    return this.campaigns.list();
  }

  async planDay(campaignId: string, input: PlanDayInput) {
    await this.get(campaignId);
    if (!Array.isArray(input?.leads)) throw new BadRequestException("leads é obrigatório");
    const ks = await this.killSwitch.get();
    if (ks.paused) {
      throw new ConflictException({
        message: "campanhas pausadas pelo kill-switch (fail-closed)",
        reason: ks.reason,
      });
    }
    const policy: AntiBanPolicy = {
      warmupDay1: this.cfg.sequencerWarmupDay1,
      warmupStep: this.cfg.sequencerWarmupStep,
      warmupCeiling: this.cfg.sequencerWarmupCeiling,
      businessHoursStart: this.cfg.sequencerBusinessHoursStart,
      businessHoursEnd: this.cfg.sequencerBusinessHoursEnd,
      jitterMinMs: this.cfg.sequencerJitterMinMs,
      jitterMaxMs: this.cfg.sequencerJitterMaxMs,
    };
    const dayIndex = input.dayIndex ?? 0;
    const plan = new Sequencer(policy).planDay(input.leads, dayIndex, new Date());
    // Nota: planDay NÃO muta contadores — envios reais são contabilizados via POST /events (idempotente).
    return { dayIndex, plan };
  }

  async simulateTurn(campaignId: string, input: SimulateTurnInput): Promise<StepResult> {
    const rec = await this.get(campaignId);
    return new ConversationStateMachine(rec.workflow).step(input.event, input.currentNode);
  }

  /** Ativa a campanha: valida plano, checa kill-switch (fail-closed) e inicia o workflow
   *  via launcher (Temporal em produção; fake determinístico em teste). C1 — API→Temporal. */
  async start(campaignId: string, input: StartCampaignInput): Promise<{ id: string; status: "active"; workflowId: string }> {
    const rec = await this.get(campaignId);
    if (!Array.isArray(input?.plans) || input.plans.length === 0) {
      throw new BadRequestException("plans é obrigatório (array não-vazio)");
    }
    const plans: CampaignPlanItem[] = input.plans.map((p, i) => {
      const channel = p?.channel;
      if (channel !== "whatsapp" && channel !== "email") {
        throw new BadRequestException(`plan[${i}]: channel inválido`);
      }
      if (!p?.body?.trim()) throw new BadRequestException(`plan[${i}]: body vazio`);
      return { leadId: p?.leadId ?? `lead-${i}`, cnpj: p?.cnpj, channel, body: p.body };
    });
    const ks = await this.killSwitch.get();
    if (ks.paused) {
      throw new ConflictException({
        message: "campanhas pausadas pelo kill-switch (fail-closed)",
        reason: ks.reason,
      });
    }
    const launch = await this.launcher.launch({ campaignId, workflow: rec.workflow, plans });
    await this.campaigns.setStatus(campaignId, "active");
    return { id: campaignId, status: "active", workflowId: launch.workflowId };
  }
}

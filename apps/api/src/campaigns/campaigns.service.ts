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
  type Channel,
  type ConversationEvent,
  type GrowthConfig,
  type StepResult,
} from "@growthos/core";
import { GROWTH_CONFIG } from "../config/config.module.js";
import {
  CAMPAIGN_STORE,
  COUNTER_STORE,
  KILL_SWITCH_STORE,
  type CampaignRecord,
  type CampaignStore,
  type CounterStore,
  type KillSwitchStore,
} from "../persistence/stores.js";

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

@Injectable()
export class CampaignsService {
  constructor(
    @Inject(CAMPAIGN_STORE) private readonly campaigns: CampaignStore,
    @Inject(COUNTER_STORE) private readonly counters: CounterStore,
    @Inject(KILL_SWITCH_STORE) private readonly killSwitch: KillSwitchStore,
    @Inject(GROWTH_CONFIG) private readonly cfg: GrowthConfig,
  ) {}

  async create(input: CreateCampaignInput): Promise<CampaignRecord> {
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
    const state = await this.counters.get();
    state.counters.sent += plan.sends.length;
    state.health.sent += plan.sends.length;
    await this.counters.set(state);
    return { dayIndex, plan };
  }

  async simulateTurn(campaignId: string, input: SimulateTurnInput): Promise<StepResult> {
    const rec = await this.get(campaignId);
    return new ConversationStateMachine(rec.workflow).step(input.event, input.currentNode);
  }
}

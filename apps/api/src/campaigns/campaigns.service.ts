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
import { InMemoryStore, type CampaignRecord } from "../store/in-memory.store.js";

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
    @Inject(InMemoryStore) private readonly store: InMemoryStore,
    @Inject(GROWTH_CONFIG) private readonly cfg: GrowthConfig,
  ) {}

  create(input: CreateCampaignInput): CampaignRecord {
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
    this.store.campaigns.set(record.id, record);
    return record;
  }

  get(id: string): CampaignRecord {
    const rec = this.store.campaigns.get(id);
    if (!rec) throw new NotFoundException(`campanha ${id} não encontrada`);
    return rec;
  }

  list(): CampaignRecord[] {
    return [...this.store.campaigns.values()];
  }

  planDay(campaignId: string, input: PlanDayInput) {
    this.get(campaignId);
    if (this.store.killSwitch.isPaused) {
      throw new ConflictException({
        message: "campanhas pausadas pelo kill-switch (fail-closed)",
        reason: this.store.killSwitch.reason,
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
    this.store.counters.sent += plan.sends.length;
    this.store.healthInput.sent += plan.sends.length;
    return { dayIndex, plan };
  }

  simulateTurn(campaignId: string, input: SimulateTurnInput): StepResult {
    const rec = this.get(campaignId);
    const machine = new ConversationStateMachine(rec.workflow);
    return machine.step(input.event, input.currentNode);
  }
}

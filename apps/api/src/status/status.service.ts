import { Inject, Injectable } from "@nestjs/common";
import { channelHealth, type GrowthConfig } from "@growthos/core";
import { GROWTH_CONFIG } from "../config/config.module.js";
import {
  COUNTER_STORE,
  KILL_SWITCH_STORE,
  LEAD_STORE,
  SUPPRESSION_STORE,
  type CounterStore,
  type KillSwitchStore,
  type LeadStore,
  type SuppressionStore,
} from "../persistence/stores.js";

@Injectable()
export class StatusService {
  private readonly startedAt = Date.now();

  constructor(
    @Inject(KILL_SWITCH_STORE) private readonly killSwitch: KillSwitchStore,
    @Inject(COUNTER_STORE) private readonly counters: CounterStore,
    @Inject(SUPPRESSION_STORE) private readonly suppression: SuppressionStore,
    @Inject(LEAD_STORE) private readonly leads: LeadStore,
    @Inject(GROWTH_CONFIG) private readonly cfg: GrowthConfig,
  ) {}

  async get() {
    const [ks, state, sup, leadCount] = await Promise.all([
      this.killSwitch.get(),
      this.counters.get(),
      this.suppression.list(),
      this.leads.countLeads(),
    ]);
    const h = state.health;
    const health = channelHealth({
      delivered: h.delivered,
      sent: h.sent,
      rejected: h.rejected,
      readRate: h.readRate,
      replyRate: h.replyRate,
      channelMin: this.cfg.healthChannelMin,
      rejectionRateMax: this.cfg.healthRejectionRateMax,
    });
    return {
      version: "1.0.0",
      mode: this.cfg.mode,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      killSwitch: ks,
      counters: state.counters,
      health,
      suppressionCount: sup.length,
      leads: leadCount,
    };
  }
}

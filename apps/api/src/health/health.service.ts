import { Inject, Injectable } from "@nestjs/common";
import { channelHealth, type GrowthConfig } from "@growthos/core";
import { GROWTH_CONFIG } from "../config/config.module.js";
import { COUNTER_STORE, KILL_SWITCH_STORE, type CounterStore, type KillSwitchStore } from "../persistence/stores.js";

@Injectable()
export class HealthService {
  constructor(
    @Inject(KILL_SWITCH_STORE) private readonly killSwitch: KillSwitchStore,
    @Inject(COUNTER_STORE) private readonly counters: CounterStore,
    @Inject(GROWTH_CONFIG) private readonly cfg: GrowthConfig,
  ) {}

  async channel() {
    const h = (await this.counters.get()).health;
    return channelHealth({
      delivered: h.delivered,
      sent: h.sent,
      rejected: h.rejected,
      readRate: h.readRate,
      replyRate: h.replyRate,
      channelMin: this.cfg.healthChannelMin,
      rejectionRateMax: this.cfg.healthRejectionRateMax,
    });
  }

  /** F-09 (HARDENING): projeção do endpoint PÚBLICO /channels/health — somente saúde operacional
   *  mínima (score/status/rejectionRate/reasons). O estado administrativo do kill-switch
   *  (paused/reason) permanece exclusivo de GET /channels/kill-switch (rota shared). */
  async publicStatus() {
    const full = await this.channel();
    return { score: full.score, status: full.status, rejectionRate: full.rejectionRate, reasons: full.reasons };
  }

  async killSwitchState() {
    return this.killSwitch.get();
  }

  async pause(reason: string) {
    await this.killSwitch.set({ paused: true, reason });
    return this.killSwitch.get();
  }

  async resume() {
    await this.killSwitch.set({ paused: false, reason: null });
    return this.killSwitch.get();
  }
}

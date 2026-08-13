import { Inject, Injectable } from "@nestjs/common";
import { channelHealth, type GrowthConfig } from "@growthos/core";
import { GROWTH_CONFIG } from "../config/config.module.js";
import { InMemoryStore } from "../store/in-memory.store.js";

@Injectable()
export class HealthService {
  constructor(
    @Inject(InMemoryStore) private readonly store: InMemoryStore,
    @Inject(GROWTH_CONFIG) private readonly cfg: GrowthConfig,
  ) {}

  channel() {
    const h = this.store.healthInput;
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

  killSwitch() {
    return { paused: this.store.killSwitch.isPaused, reason: this.store.killSwitch.reason };
  }

  pause(reason: string) {
    this.store.killSwitch.pause(reason);
    return this.killSwitch();
  }

  resume() {
    this.store.killSwitch.resume();
    return this.killSwitch();
  }

  ingest(c: { delivered?: number; rejected?: number; readRate?: number; replyRate?: number }) {
    this.store.healthInput = {
      ...this.store.healthInput,
      delivered: c.delivered ?? this.store.healthInput.delivered,
      rejected: c.rejected ?? this.store.healthInput.rejected,
      readRate: c.readRate ?? this.store.healthInput.readRate,
      replyRate: c.replyRate ?? this.store.healthInput.replyRate,
    };
    return this.channel();
  }
}

import { Inject, Injectable } from "@nestjs/common";
import { arrProjected, funnelMetrics, type GrowthConfig } from "@growthos/core";
import { GROWTH_CONFIG } from "../config/config.module.js";
import { COUNTER_STORE, type CounterStore } from "../persistence/stores.js";

@Injectable()
export class MetricsService {
  constructor(
    @Inject(COUNTER_STORE) private readonly counters: CounterStore,
    @Inject(GROWTH_CONFIG) private readonly cfg: GrowthConfig,
  ) {}

  async funnel() {
    const { counters } = await this.counters.get();
    return {
      counters,
      metrics: funnelMetrics(counters),
      arr_projected: arrProjected(counters.qualified, this.cfg.arrScheduleRate, this.cfg.arrCloseRate, this.cfg.arrTicketMonthly),
      arr_params: {
        scheduleRate: this.cfg.arrScheduleRate,
        closeRate: this.cfg.arrCloseRate,
        ticketMonthly: this.cfg.arrTicketMonthly,
      },
    };
  }
}

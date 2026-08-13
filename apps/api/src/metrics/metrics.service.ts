import { Inject, Injectable } from "@nestjs/common";
import { arrProjected, funnelMetrics } from "@growthos/core";
import { COUNTER_STORE, type CounterStore } from "../persistence/stores.js";

@Injectable()
export class MetricsService {
  constructor(@Inject(COUNTER_STORE) private readonly counters: CounterStore) {}

  async funnel() {
    const { counters } = await this.counters.get();
    return {
      counters,
      metrics: funnelMetrics(counters),
      arr_projected: arrProjected(counters.qualified, 55, 20, 1500),
    };
  }
}

import { Inject, Injectable } from "@nestjs/common";
import { arrProjected, funnelMetrics } from "@growthos/core";
import { InMemoryStore } from "../store/in-memory.store.js";

@Injectable()
export class MetricsService {
  constructor(@Inject(InMemoryStore) private readonly store: InMemoryStore) {}

  funnel() {
    const counters = this.store.counters;
    return {
      counters,
      metrics: funnelMetrics(counters),
      arr_projected: arrProjected(counters.qualified, 55, 20, 1500),
    };
  }
}

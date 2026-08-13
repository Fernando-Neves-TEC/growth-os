import { Controller, Get, Inject } from "@nestjs/common";
import { MetricsService } from "./metrics.service.js";

@Controller("metrics")
export class MetricsController {
  constructor(@Inject(MetricsService) private readonly metrics: MetricsService) {}

  @Get("funnel")
  funnel() {
    return this.metrics.funnel();
  }
}

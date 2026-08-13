import { Controller, Get, Inject } from "@nestjs/common";
import { Human } from "../auth/auth.decorators.js";
import { MetricsService } from "./metrics.service.js";

@Controller("metrics")
export class MetricsController {
  constructor(@Inject(MetricsService) private readonly metrics: MetricsService) {}

  @Human()
  @Get("funnel")
  funnel() {
    return this.metrics.funnel();
  }
}

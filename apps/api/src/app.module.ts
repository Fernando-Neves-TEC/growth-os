import { Module } from "@nestjs/common";
import { CampaignsModule } from "./campaigns/campaigns.module.js";
import { ConfigModule } from "./config/config.module.js";
import { HealthModule } from "./health/health.module.js";
import { MetricsModule } from "./metrics/metrics.module.js";
import { StoreModule } from "./store/store.module.js";

@Module({
  imports: [ConfigModule, StoreModule, CampaignsModule, HealthModule, MetricsModule],
})
export class AppModule {}

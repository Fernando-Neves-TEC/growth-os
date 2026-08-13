import { Module } from "@nestjs/common";
import { CampaignsModule } from "./campaigns/campaigns.module.js";
import { ConfigModule } from "./config/config.module.js";
import { HealthModule } from "./health/health.module.js";
import { MetricsModule } from "./metrics/metrics.module.js";
import { PersistenceModule } from "./persistence/persistence.module.js";
import { SuppressionModule } from "./suppression/suppression.module.js";

@Module({
  imports: [ConfigModule, PersistenceModule, CampaignsModule, HealthModule, MetricsModule, SuppressionModule],
})
export class AppModule {}

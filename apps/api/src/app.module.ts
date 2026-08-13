import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { CampaignsModule } from "./campaigns/campaigns.module.js";
import { ConfigModule } from "./config/config.module.js";
import { EventsModule } from "./events/events.module.js";
import { HealthModule } from "./health/health.module.js";
import { LeadsModule } from "./leads/leads.module.js";
import { MetricsModule } from "./metrics/metrics.module.js";
import { PersistenceModule } from "./persistence/persistence.module.js";
import { ApiKeyGuard } from "./security/api-key.guard.js";
import { AllExceptionsFilter } from "./security/exception.filter.js";
import { StatusModule } from "./status/status.module.js";
import { SuppressionModule } from "./suppression/suppression.module.js";

@Module({
  imports: [
    ConfigModule,
    PersistenceModule,
    CampaignsModule,
    HealthModule,
    MetricsModule,
    SuppressionModule,
    EventsModule,
    LeadsModule,
    StatusModule,
    // H6 — rate limiting configurável (por IP). approved usa limites reais; local usa default generoso.
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: "default",
            ttl: Number(process.env.GROWTHOS_RATE_LIMIT_TTL_MS ?? 60000),
            limit: Number(process.env.GROWTHOS_RATE_LIMIT_MAX ?? 1000),
          },
        ],
      }),
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

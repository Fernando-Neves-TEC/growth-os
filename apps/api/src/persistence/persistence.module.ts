import { Global, Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import {
  PgCampaignStore,
  PgCounterStore,
  PgEventStore,
  PgKillSwitchStore,
  PgLeadStore,
  PgSuppressionStore,
} from "./pg.stores.js";
import { CAMPAIGN_STORE, COUNTER_STORE, EVENT_STORE, KILL_SWITCH_STORE, LEAD_STORE, SUPPRESSION_STORE } from "./stores.js";

/** Persistência durável (PostgreSQL). Em testes, os tokens são sobrescritos com impls em memória. */
@Global()
@Module({
  imports: [DbModule],
  providers: [
    { provide: KILL_SWITCH_STORE, useClass: PgKillSwitchStore },
    { provide: SUPPRESSION_STORE, useClass: PgSuppressionStore },
    { provide: CAMPAIGN_STORE, useClass: PgCampaignStore },
    { provide: COUNTER_STORE, useClass: PgCounterStore },
    { provide: EVENT_STORE, useClass: PgEventStore },
    { provide: LEAD_STORE, useClass: PgLeadStore },
  ],
  exports: [KILL_SWITCH_STORE, SUPPRESSION_STORE, CAMPAIGN_STORE, COUNTER_STORE, EVENT_STORE, LEAD_STORE],
})
export class PersistenceModule {}

import { Global, Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { PgCampaignStore, PgCounterStore, PgKillSwitchStore, PgSuppressionStore } from "./pg.stores.js";
import { CAMPAIGN_STORE, COUNTER_STORE, KILL_SWITCH_STORE, SUPPRESSION_STORE } from "./stores.js";

/** Persistência durável (PostgreSQL). Em testes, os tokens são sobrescritos com impls em memória. */
@Global()
@Module({
  imports: [DbModule],
  providers: [
    { provide: KILL_SWITCH_STORE, useClass: PgKillSwitchStore },
    { provide: SUPPRESSION_STORE, useClass: PgSuppressionStore },
    { provide: CAMPAIGN_STORE, useClass: PgCampaignStore },
    { provide: COUNTER_STORE, useClass: PgCounterStore },
  ],
  exports: [KILL_SWITCH_STORE, SUPPRESSION_STORE, CAMPAIGN_STORE, COUNTER_STORE],
})
export class PersistenceModule {}

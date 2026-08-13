/** H6 — rate limiting por IP (ThrottlerGuard). Com limite baixo, excede → 429. */
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { WORKFLOW_LAUNCHER } from "../src/campaigns/workflow-launcher.js";
import {
  CAMPAIGN_STORE,
  COUNTER_STORE,
  EVENT_STORE,
  KILL_SWITCH_STORE,
  LEAD_STORE,
  MemoryCampaignStore,
  MemoryCounterStore,
  MemoryEventStore,
  MemoryKillSwitchStore,
  MemoryLeadStore,
  MemorySuppressionStore,
  SUPPRESSION_STORE,
} from "../src/persistence/stores.js";

describe("Rate limiting (H6)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.GROWTHOS_RATE_LIMIT_MAX = "3";
    process.env.GROWTHOS_RATE_LIMIT_TTL_MS = "60000";
    const counterStore = new MemoryCounterStore();
    const suppressionStore = new MemorySuppressionStore();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KILL_SWITCH_STORE)
      .useValue(new MemoryKillSwitchStore())
      .overrideProvider(SUPPRESSION_STORE)
      .useValue(suppressionStore)
      .overrideProvider(CAMPAIGN_STORE)
      .useValue(new MemoryCampaignStore())
      .overrideProvider(COUNTER_STORE)
      .useValue(counterStore)
      .overrideProvider(EVENT_STORE)
      .useValue(new MemoryEventStore({ counters: counterStore, suppression: suppressionStore }))
      .overrideProvider(LEAD_STORE)
      .useValue(new MemoryLeadStore())
      .overrideProvider(WORKFLOW_LAUNCHER)
      .useValue({ launch: async () => ({ workflowId: "fake" }) })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.GROWTHOS_RATE_LIMIT_MAX;
    delete process.env.GROWTHOS_RATE_LIMIT_TTL_MS;
    await app.close();
  });

  it("limite de 3/min → 4ª requisição recebe 429", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer()).get("/status").expect(200);
    }
    await request(app.getHttpServer()).get("/status").expect(429);
  });

  it("resposta 429 é estruturada", async () => {
    const res = await request(app.getHttpServer()).get("/status").expect(429);
    expect(res.body.statusCode).toBe(429);
    expect(res.body.message).toBeDefined();
  });
});

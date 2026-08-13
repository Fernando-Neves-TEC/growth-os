/** H6/S10 — rate limiting por IP (ThrottlerGuard) + evento RATE_LIMIT_HIT (sem segredos) + brute force no login. */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { MemorySecurityAuditStore, SECURITY_AUDIT_STORE } from "../src/auth/stores.js";
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

async function buildThrottledApp(audit: MemorySecurityAuditStore) {
  process.env.GROWTHOS_RATE_LIMIT_MAX = "3";
  process.env.GROWTHOS_RATE_LIMIT_TTL_MS = "60000";
  const counterStore = new MemoryCounterStore();
  const suppressionStore = new MemorySuppressionStore();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(KILL_SWITCH_STORE).useValue(new MemoryKillSwitchStore())
    .overrideProvider(SUPPRESSION_STORE).useValue(suppressionStore)
    .overrideProvider(CAMPAIGN_STORE).useValue(new MemoryCampaignStore())
    .overrideProvider(COUNTER_STORE).useValue(counterStore)
    .overrideProvider(EVENT_STORE).useValue(new MemoryEventStore({ counters: counterStore, suppression: suppressionStore }))
    .overrideProvider(LEAD_STORE).useValue(new MemoryLeadStore())
    .overrideProvider(SECURITY_AUDIT_STORE).useValue(audit)
    .overrideProvider(WORKFLOW_LAUNCHER).useValue({ launch: async () => ({ workflowId: "fake" }) })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

describe("Rate limiting — rota pública (H6/S10)", () => {
  let app: INestApplication;
  let audit: MemorySecurityAuditStore;

  beforeAll(async () => {
    audit = new MemorySecurityAuditStore();
    app = await buildThrottledApp(audit);
  });

  afterAll(async () => {
    delete process.env.GROWTHOS_RATE_LIMIT_MAX;
    delete process.env.GROWTHOS_RATE_LIMIT_TTL_MS;
    await app.close();
  });

  it("limite de 3/min → 4ª requisição em rota pública recebe 429", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer()).get("/channels/health").expect(200);
    }
    const res = await request(app.getHttpServer()).get("/channels/health").expect(429);
    expect(res.body.statusCode).toBe(429);
    expect(res.body.message).toBeDefined();
  });

  it("S10: 429 gera evento RATE_LIMIT_HIT persistido sem valores de segredo", async () => {
    const events = await audit.list(100);
    const hits = events.filter((e) => e.event === "RATE_LIMIT_HIT");
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      const blob = JSON.stringify(h);
      expect(blob).not.toContain("SenhaErrada1");
      expect(blob).not.toMatch(/postgres:\/\/|connectionstring/i);
    }
  });
});

describe("Rate limiting — brute force no login (S2)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildThrottledApp(new MemorySecurityAuditStore());
  });

  afterAll(async () => {
    delete process.env.GROWTHOS_RATE_LIMIT_MAX;
    delete process.env.GROWTHOS_RATE_LIMIT_TTL_MS;
    await app.close();
  });

  it("4ª tentativa de login → 429 (rate limit cobre /auth/login)", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer()).post("/auth/login").send({ email: "nao-existe@test.local", password: "SenhaErrada1" }).expect(401);
    }
    const res = await request(app.getHttpServer()).post("/auth/login").send({ email: "nao-existe@test.local", password: "SenhaErrada1" }).expect(429);
    expect(res.body.statusCode).toBe(429);
  });
});

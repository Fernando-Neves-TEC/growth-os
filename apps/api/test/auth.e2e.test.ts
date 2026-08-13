/** Autenticação fail-closed (C2) — modo approved exige API key em todas as rotas. */
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
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

const KEY = "test-secret-123";

describe("Autenticação fail-closed (C2, modo approved)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.GROWTHOS_MODE = "approved";
    process.env.GROWTHOS_API_KEY = KEY;
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
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    delete process.env.GROWTHOS_MODE;
    delete process.env.GROWTHOS_API_KEY;
    await app.close();
  });

  it("GET /status sem header → 401 (fail-closed em produção)", async () => {
    await request(app.getHttpServer()).get("/status").expect(401);
  });

  it("chave errada → 401", async () => {
    await request(app.getHttpServer()).get("/status").set("x-api-key", "errada").expect(401);
  });

  it("chave correta → 200 (dashboard autenticado funciona)", async () => {
    const res = await request(app.getHttpServer()).get("/status").set("x-api-key", KEY).expect(200);
    expect(res.body.mode).toBe("approved");
    const m = await request(app.getHttpServer()).get("/metrics/funnel").set("x-api-key", KEY).expect(200);
    expect(typeof m.body.arr_projected).toBe("number");
  });

  it("escrita também exige a chave (eventos)", async () => {
    await request(app.getHttpServer()).post("/events").send({ eventId: "a1", type: "sent" }).expect(401);
  });
});

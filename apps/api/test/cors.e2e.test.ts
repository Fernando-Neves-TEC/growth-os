/**
 * GAUNTLET SECURITY CLOSURE — MÉDIO: CORS fail-closed.
 * Simulação NÃO reflete origem arbitrária (antes: origin:true). Agora:
 *  - simulação (padrão): allowlist LOCAL explícita [localhost:5173, 127.0.0.1:5173];
 *  - GROWTHOS_CORS_ORIGINS presente: allowlist explícita (sempre tem precedência);
 *  - approved sem allowlist: nenhuma origem (fail-closed);
 * Nunca wildcard, nunca reflete origem fora da allowlist.
 */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
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

async function buildAppWith(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  process.env.GROWTHOS_RATE_LIMIT_MAX = "100000";
  process.env.GROWTHOS_BODY_LIMIT = "4kb";
  const counterStore = new MemoryCounterStore();
  const suppressionStore = new MemorySuppressionStore();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(KILL_SWITCH_STORE).useValue(new MemoryKillSwitchStore())
    .overrideProvider(SUPPRESSION_STORE).useValue(suppressionStore)
    .overrideProvider(CAMPAIGN_STORE).useValue(new MemoryCampaignStore())
    .overrideProvider(COUNTER_STORE).useValue(counterStore)
    .overrideProvider(EVENT_STORE).useValue(new MemoryEventStore({ counters: counterStore, suppression: suppressionStore }))
    .overrideProvider(LEAD_STORE).useValue(new MemoryLeadStore())
    .overrideProvider(WORKFLOW_LAUNCHER).useValue({ launch: async () => ({ workflowId: "fake" }) })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

const ALLOWED_SIM = ["http://localhost:5173", "http://127.0.0.1:5173"];
const EVIL = ["http://evil.example", "http://localhost:9999"];

async function allowOriginFor(app: INestApplication, origin: string) {
  const res = await request(app.getHttpServer()).get("/channels/health").set("Origin", origin).expect(200);
  return res.headers["access-control-allow-origin"];
}

describe("CORS fail-closed em simulação (MÉDIO SECURITY CLOSURE)", () => {
  afterAll(async () => {
    delete process.env.GROWTHOS_MODE;
    delete process.env.GROWTHOS_CORS_ORIGINS;
  });

  it("origens locais do dashboard são autorizadas; origem arbitrária NÃO reflete (antes: origin:true)", async () => {
    const app = await buildAppWith({ GROWTHOS_MODE: "simulation" });
    try {
      for (const origin of ALLOWED_SIM) {
        expect(await allowOriginFor(app, origin)).toBe(origin);
      }
      for (const origin of EVIL) {
        expect(await allowOriginFor(app, origin)).toBeUndefined();
      }
    } finally {
      await app.close();
    }
  });

  it("GROWTHOS_CORS_ORIGINS tem precedência: lista autorizada; fora da lista bloqueado", async () => {
    const app = await buildAppWith({ GROWTHOS_MODE: "simulation", GROWTHOS_CORS_ORIGINS: "http://app.growthos.local, http://localhost:3001" });
    try {
      expect(await allowOriginFor(app, "http://app.growthos.local")).toBe("http://app.growthos.local");
      expect(await allowOriginFor(app, "http://localhost:3001")).toBe("http://localhost:3001");
      expect(await allowOriginFor(app, "http://evil.example")).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});

describe("CORS fail-closed em approved (MÉDIO SECURITY CLOSURE)", () => {
  afterAll(async () => {
    delete process.env.GROWTHOS_MODE;
    delete process.env.GROWTHOS_CORS_ORIGINS;
  });

  it("approved sem allowlist → nenhuma origem autorizada (fail-closed)", async () => {
    const app = await buildAppWith({ GROWTHOS_MODE: "approved" });
    try {
      for (const origin of [...ALLOWED_SIM, ...EVIL]) {
        expect(await allowOriginFor(app, origin)).toBeUndefined();
      }
    } finally {
      await app.close();
    }
  });

  it("approved COM allowlist → origens listadas autorizadas; fora da lista bloqueado", async () => {
    const app = await buildAppWith({ GROWTHOS_MODE: "approved", GROWTHOS_CORS_ORIGINS: "https://dashboard.growthos.app" });
    try {
      expect(await allowOriginFor(app, "https://dashboard.growthos.app")).toBe("https://dashboard.growthos.app");
      expect(await allowOriginFor(app, "http://evil.example")).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});

/**
 * GAUNTLET SECURITY CLOSURE — ALTO: limite ESPECÍFICO para POST /auth/login (5/min por IP),
 * independente do limite global. Mecanismo oficial @nestjs/throttler via @Throttle no controller.
 *
 * Roda sob CONFIGURAÇÃO PADRÃO (sem override do GROWTHOS_RATE_LIMIT_MAX) para provar que o
 * bloqueio vem do limite de login e não do global (default 1000/min — nunca dispararia em 6 req).
 */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { AuthService } from "../src/auth/auth.service.js";
import {
  MemoryOperatorsStore,
  MemorySecurityAuditStore,
  MemorySessionStore,
  OPERATORS_STORE,
  SECURITY_AUDIT_STORE,
  SESSION_STORE,
} from "../src/auth/stores.js";
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

const EMAIL = "admin@test.local";
const PASSWORD = "SenhaTeste123!";
const WRONG = { email: "nao-existe@test.local", password: "SenhaErrada1" };

async function buildLoginApp() {
  // Configuração PADRÃO: sem GROWTHOS_RATE_LIMIT_MAX/TTL — global fica 1000/min (não dispara).
  delete process.env.GROWTHOS_RATE_LIMIT_MAX;
  delete process.env.GROWTHOS_RATE_LIMIT_TTL_MS;
  const counterStore = new MemoryCounterStore();
  const suppressionStore = new MemorySuppressionStore();
  const operators = new MemoryOperatorsStore();
  const sessions = new MemorySessionStore();
  const audit = new MemorySecurityAuditStore();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(KILL_SWITCH_STORE).useValue(new MemoryKillSwitchStore())
    .overrideProvider(SUPPRESSION_STORE).useValue(suppressionStore)
    .overrideProvider(CAMPAIGN_STORE).useValue(new MemoryCampaignStore())
    .overrideProvider(COUNTER_STORE).useValue(counterStore)
    .overrideProvider(EVENT_STORE).useValue(new MemoryEventStore({ counters: counterStore, suppression: suppressionStore }))
    .overrideProvider(LEAD_STORE).useValue(new MemoryLeadStore())
    .overrideProvider(OPERATORS_STORE).useValue(operators)
    .overrideProvider(SESSION_STORE).useValue(sessions)
    .overrideProvider(SECURITY_AUDIT_STORE).useValue(audit)
    .overrideProvider(WORKFLOW_LAUNCHER).useValue({ launch: async () => ({ workflowId: "fake" }) })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return { app, audit, auth: moduleRef.get(AuthService) };
}

describe("Rate limiting — login específico 5/min (ALTO SECURITY CLOSURE)", () => {
  afterAll(async () => {
    delete process.env.GROWTHOS_RATE_LIMIT_MAX;
    delete process.env.GROWTHOS_RATE_LIMIT_TTL_MS;
  });

  it("1ª a 5ª tentativas erradas → 401; 6ª → 429 (limite de 5/min do login, config padrão)", async () => {
    const { app } = await buildLoginApp();
    try {
      for (let i = 1; i <= 5; i++) {
        await request(app.getHttpServer()).post("/auth/login").send(WRONG).expect(401);
      }
      const res = await request(app.getHttpServer()).post("/auth/login").send(WRONG).expect(429);
      expect(res.body.statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });

  it("login correto dentro do limite NÃO é bloqueado (4 erradas + 1 correta → 201)", async () => {
    const { app, auth } = await buildLoginApp();
    try {
      await auth.createOperator(EMAIL, PASSWORD);
      for (let i = 0; i < 4; i++) {
        await request(app.getHttpServer()).post("/auth/login").send({ email: EMAIL, password: "SenhaErrada1" }).expect(401);
      }
      await request(app.getHttpServer()).post("/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(201);
    } finally {
      await app.close();
    }
  });

  it("header X-Forwarded-For forjado NÃO ignora o contador (limite por IP do socket)", async () => {
    const { app } = await buildLoginApp();
    try {
      for (let i = 1; i <= 5; i++) {
        await request(app.getHttpServer()).post("/auth/login").set("X-Forwarded-For", "203.0.113.99").send(WRONG).expect(401);
      }
      // 6ª tentativa (mesmo header forjado) → 429: o throttler não confia no header.
      const res = await request(app.getHttpServer()).post("/auth/login").set("X-Forwarded-For", "203.0.113.99").send(WRONG).expect(429);
      expect(res.body.statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });

  it("RATE_LIMIT_HIT persistido, sem e-mail nem senha nos metadados", async () => {
    const { app, audit } = await buildLoginApp();
    try {
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer()).post("/auth/login").send(WRONG).expect(i < 5 ? 401 : 429);
      }
      const events = await audit.list(100);
      const hits = events.filter((e) => e.event === "RATE_LIMIT_HIT");
      expect(hits.length).toBeGreaterThan(0);
      for (const h of hits) {
        const blob = JSON.stringify(h);
        expect(blob).not.toContain("SenhaErrada1");
        expect(blob).not.toContain(WRONG.email);
        expect(blob).not.toMatch(/postgres:\/\/|connectionstring/i);
      }
    } finally {
      await app.close();
    }
  });
});

/**
 * SECURITY HARDENING FINAL — provas das correções dos resíduos da auditoria (F-01..F-14).
 * - F-02: teto de tamanho de email (max 254) — gigante rejeitado ANTES do AuthService/auditoria.
 * - F-07: comparação timing-safe da API key (correta/errada/ausente/comprimento diferente).
 * - F-09: health público sanitizado (sem estado administrativo); /channels/kill-switch protegido.
 * - F-11/F-14: 429 com mensagem genérica (sem classe interna) e sem X-Powered-By.
 * - F-03: CORS permitido/bloqueado continua funcional.
 */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
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

async function buildApp(env: Record<string, string>, opts: { rateHigh?: boolean; bodyLimit?: string } = {}) {
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  if (opts.rateHigh) process.env.GROWTHOS_RATE_LIMIT_MAX = "100000";
  else delete process.env.GROWTHOS_RATE_LIMIT_MAX; // config padrão (prova F-11 429 genérico)
  process.env.GROWTHOS_BODY_LIMIT = opts.bodyLimit ?? "4kb";
  const counterStore = new MemoryCounterStore();
  const suppressionStore = new MemorySuppressionStore();
  const audit = new MemorySecurityAuditStore();
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
  return { app, audit };
}

describe("Hardening — email max 254 (F-02)", () => {
  afterAll(async () => {
    delete process.env.GROWTHOS_MODE;
    delete process.env.GROWTHOS_RATE_LIMIT_MAX;
  });

  it("email sintaticamente válido (≤254) segue o fluxo (401 por inexistência, NÃO 400)", async () => {
    const { app } = await buildApp({ GROWTHOS_MODE: "simulation" }, { rateHigh: true, bodyLimit: "200kb" });
    try {
      const email = `${"a".repeat(120)}@example.com`; // 132 chars, válido e < 254
      const res = await request(app.getHttpServer()).post("/auth/login").send({ email, password: "SenhaErrada1" }).expect(401);
      expect(res.body.message).toBe("credenciais inválidas");
    } finally {
      await app.close();
    }
  });

  it("email >254 → 400 (rejeitado ANTES do AuthService)", async () => {
    const { app, audit } = await buildApp({ GROWTHOS_MODE: "simulation" }, { rateHigh: true, bodyLimit: "200kb" });
    try {
      const email = `${"a".repeat(250)}@example.com`; // 262 chars
      await request(app.getHttpServer()).post("/auth/login").send({ email, password: "SenhaErrada1" }).expect(400);
      // F-02: o email rejeitado NÃO chega ao log de auditoria (AuthService nunca é chamado).
      const events = await audit.list(100);
      expect(events.some((e) => e.metadata?.email === email)).toBe(false);
    } finally {
      await app.close();
    }
  });

  it("email gigante (5000 chars) → 400, sem evento de auditoria", async () => {
    const { app, audit } = await buildApp({ GROWTHOS_MODE: "simulation" }, { rateHigh: true, bodyLimit: "200kb" });
    try {
      const email = `${"a".repeat(5000)}@x.com`;
      await request(app.getHttpServer()).post("/auth/login").send({ email, password: "SenhaErrada1" }).expect(400);
      const events = await audit.list(100);
      expect(events.some((e) => e.metadata?.email === email)).toBe(false);
    } finally {
      await app.close();
    }
  });
});

describe("Hardening — API key timing-safe + kill-switch protegido (F-07/F-09)", () => {
  const KEY = "harden-m2m-local-key";
  afterAll(async () => {
    delete process.env.GROWTHOS_MODE;
    delete process.env.GROWTHOS_API_KEY;
  });

  it("approved: kill-switch sem chave → 401; chave correta → 200; errada → 401; comprimento diferente → 401", async () => {
    const { app } = await buildApp({ GROWTHOS_MODE: "approved", GROWTHOS_API_KEY: KEY }, { rateHigh: true });
    try {
      const server = app.getHttpServer();
      await request(server).get("/channels/kill-switch").expect(401); // ausente
      await request(server).get("/channels/kill-switch").set("X-Api-Key", KEY).expect(200); // correta
      await request(server).get("/channels/kill-switch").set("X-Api-Key", "errada-nao-bate").expect(401); // errada
      await request(server).get("/channels/kill-switch").set("X-Api-Key", "curta").expect(401); // comprimento diferente
    } finally {
      await app.close();
    }
  });

  it("approved: /events sem chave → 401; com chave correta → 201 (M2M continua funcional)", async () => {
    const { app } = await buildApp({ GROWTHOS_MODE: "approved", GROWTHOS_API_KEY: KEY }, { rateHigh: true });
    try {
      const server = app.getHttpServer();
      await request(server).post("/events").send({ eventId: "harden-m2m-1", type: "sent" }).expect(401);
      await request(server).post("/events").set("X-Api-Key", KEY).send({ eventId: "harden-m2m-1", type: "sent" }).expect(201);
    } finally {
      await app.close();
    }
  });
});

describe("Hardening — 429 genérico + sem X-Powered-By (F-11/F-14)", () => {
  afterAll(async () => {
    delete process.env.GROWTHOS_MODE;
  });

  it("6ª tentativa de login errada → 429 com mensagem genérica (sem classe interna ThrottlerException)", async () => {
    const { app } = await buildApp({ GROWTHOS_MODE: "simulation" }); // config padrão → login 5/min
    try {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).post("/auth/login").send({ email: "nao-existe@test.local", password: "SenhaErrada1" }).expect(401);
      }
      const res = await request(app.getHttpServer()).post("/auth/login").send({ email: "nao-existe@test.local", password: "SenhaErrada1" }).expect(429);
      expect(res.body.statusCode).toBe(429);
      expect(res.body.message).toBe("muitas requisições");
      expect(JSON.stringify(res.body)).not.toContain("ThrottlerException");
    } finally {
      await app.close();
    }
  });

  it("respostas não expõem X-Powered-By", async () => {
    const { app } = await buildApp({ GROWTHOS_MODE: "simulation" }, { rateHigh: true });
    try {
      const res = await request(app.getHttpServer()).get("/channels/health").expect(200);
      expect(res.headers["x-powered-by"]).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});

describe("Hardening — health público sanitizado (F-09)", () => {
  afterAll(async () => {
    delete process.env.GROWTHOS_MODE;
  });

  it("GET /channels/health público NÃO contém killSwitch (só saúde operacional)", async () => {
    const { app } = await buildApp({ GROWTHOS_MODE: "simulation" }, { rateHigh: true });
    try {
      const res = await request(app.getHttpServer()).get("/channels/health").expect(200);
      expect(res.body).not.toHaveProperty("killSwitch");
      expect(res.body).toHaveProperty("score");
      expect(res.body).toHaveProperty("status");
      expect(res.body).toHaveProperty("rejectionRate");
      expect(res.body).toHaveProperty("reasons");
    } finally {
      await app.close();
    }
  });
});

describe("Hardening — CORS continua fail-closed (F-03 regressão)", () => {
  afterAll(async () => {
    delete process.env.GROWTHOS_MODE;
  });

  it("simulation: origem local permitida; origem arbitrária bloqueada", async () => {
    const { app } = await buildApp({ GROWTHOS_MODE: "simulation" }, { rateHigh: true });
    try {
      const allowed = await request(app.getHttpServer()).get("/channels/health").set("Origin", "http://localhost:5173").expect(200);
      expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      const evil = await request(app.getHttpServer()).get("/channels/health").set("Origin", "http://evil.example").expect(200);
      expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});

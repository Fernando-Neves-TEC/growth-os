/** S2 — autenticação humana + matriz de autorização (sessão ≠ API key M2M) + CORS approved. */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

async function buildApp(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  process.env.GROWTHOS_RATE_LIMIT_MAX = "100000";
  process.env.GROWTHOS_BODY_LIMIT = "4kb";
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
  return { app, operators, sessions, audit, auth: moduleRef.get(AuthService) };
}

describe("S2 — autenticação humana (simulação)", () => {
  afterAll(async () => {
    delete process.env.GROWTHOS_MODE;
  });

  // App fresca POR TESTE: o limite de login (5/min via @Throttle no controller) usa storage
  // in-memory por app — cada teste tem janela própria e a suíte funcional não disputa o
  // contador do brute force (coberto em login-rate.e2e.test.ts sob config padrão).
  async function freshApp() {
    return buildApp({ GROWTHOS_MODE: "simulation" });
  }

  async function authedApp() {
    const built = await buildApp({ GROWTHOS_MODE: "simulation" });
    await built.auth.createOperator(EMAIL, PASSWORD);
    const agent = request.agent(built.app.getHttpServer());
    const login = await agent.post("/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(201);
    return { app: built.app, operators: built.operators, auth: built.auth, agent, csrf: login.body.csrfToken };
  }

  it("login correto → 201: operador não-sensível + CSRF + cookie de sessão (HttpOnly/SameSite/Path)", async () => {
    const { app, auth } = await freshApp();
    try {
      await auth.createOperator(EMAIL, PASSWORD);
      const agent = request.agent(app.getHttpServer());
      const res = await agent.post("/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(201);
      expect(res.body.operator.email).toBe(EMAIL);
      expect(res.body.operator).not.toHaveProperty("passwordHash");
      expect(res.body.operator).not.toHaveProperty("password");
      expect(typeof res.body.csrfToken).toBe("string");
      const cookie = res.headers["set-cookie"]?.[0] ?? "";
      expect(cookie).toContain("growthos_session=");
      expect(cookie.toLowerCase()).toContain("httponly");
      expect(cookie.toLowerCase()).toContain("samesite=lax");
      expect(cookie.toLowerCase()).toContain("path=/");
    } finally {
      await app.close();
    }
  });

  it("login usuário inexistente → 401 genérico (sem enumeração)", async () => {
    const { app } = await freshApp();
    try {
      const res = await request(app.getHttpServer()).post("/auth/login").send({ email: "nao-existe@test.local", password: "SenhaErrada1" }).expect(401);
      expect(res.body.message).toBe("credenciais inválidas");
    } finally {
      await app.close();
    }
  });

  it("login senha errada → 401 mesma mensagem (sem enumeração)", async () => {
    const { app } = await freshApp();
    try {
      const res = await request(app.getHttpServer()).post("/auth/login").send({ email: EMAIL, password: "SenhaErrada1" }).expect(401);
      expect(res.body.message).toBe("credenciais inválidas");
    } finally {
      await app.close();
    }
  });

  it("login senha vazia/curta → 400 (validação estruturada)", async () => {
    const { app } = await freshApp();
    try {
      await request(app.getHttpServer()).post("/auth/login").send({ email: EMAIL, password: "" }).expect(400);
      await request(app.getHttpServer()).post("/auth/login").send({ email: EMAIL, password: "curta" }).expect(400);
    } finally {
      await app.close();
    }
  });

  it("login email inválido → 400", async () => {
    const { app } = await freshApp();
    try {
      await request(app.getHttpServer()).post("/auth/login").send({ email: "invalido", password: PASSWORD }).expect(400);
    } finally {
      await app.close();
    }
  });

  it("login operador inativo → 401 mesma mensagem", async () => {
    const { app, operators, auth } = await freshApp();
    try {
      await auth.createOperator("inativo@test.local", "SenhaInativa1!");
      await operators.setActive((await operators.findByEmail("inativo@test.local"))!.id, false);
      const res = await request(app.getHttpServer()).post("/auth/login").send({ email: "inativo@test.local", password: "SenhaInativa1!" }).expect(401);
      expect(res.body.message).toBe("credenciais inválidas");
    } finally {
      await app.close();
    }
  });

  it("GET /auth/me sem sessão → 401", async () => {
    const { app } = await freshApp();
    try {
      await request(app.getHttpServer()).get("/auth/me").expect(401);
    } finally {
      await app.close();
    }
  });

  it("GET /auth/me com sessão → 200 + operador + csrf", async () => {
    const { app, agent } = await authedApp();
    try {
      const res = await agent.get("/auth/me").expect(200);
      expect(res.body.operator.email).toBe(EMAIL);
      expect(typeof res.body.csrfToken).toBe("string");
    } finally {
      await app.close();
    }
  });

  it("cookie adulterado → 401", async () => {
    const { app } = await freshApp();
    try {
      await request(app.getHttpServer()).get("/auth/me").set("Cookie", "growthos_session=token-invalido-aleatorio").expect(401);
    } finally {
      await app.close();
    }
  });

  it("mutação sem CSRF → 403; com CSRF → sucesso (sessão humana)", async () => {
    const { app, agent, csrf } = await authedApp();
    try {
      await request(app.getHttpServer()).post("/channels/pause").send({ reason: "x" }).expect(401); // sem sessão
      const noCsrf = await agent.post("/channels/pause").send({ reason: "x" }).expect(403);
      expect(noCsrf.body.statusCode).toBe(403);
      const ok = await agent.post("/channels/pause").set("X-CSRF-Token", csrf).send({ reason: "x" }).expect(201);
      expect(ok.body.paused).toBe(true);
      await agent.post("/channels/resume").set("X-CSRF-Token", csrf).send({}).expect(201);
    } finally {
      await app.close();
    }
  });

  it("rota humana sem sessão → 401; com sessão → 200", async () => {
    const { app, agent } = await authedApp();
    try {
      await request(app.getHttpServer()).get("/status").expect(401);
      const res = await agent.get("/status").expect(200);
      expect(res.body.mode).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it("rota pública /channels/health sem autenticação → 200", async () => {
    const { app } = await freshApp();
    try {
      await request(app.getHttpServer()).get("/channels/health").expect(200);
    } finally {
      await app.close();
    }
  });

  it("rota shared (POST /events) aceita sessão + CSRF", async () => {
    const { app, agent, csrf } = await authedApp();
    try {
      const res = await agent.post("/events").set("X-CSRF-Token", csrf).send({ eventId: "auth-shared-1", type: "sent" }).expect(201);
      expect(res.body.duplicate).toBe(false);
    } finally {
      await app.close();
    }
  });

  it("logout invalida a sessão → /auth/me 401 e rota humana 401", async () => {
    const { app, agent, csrf } = await authedApp();
    try {
      await agent.post("/auth/logout").set("X-CSRF-Token", csrf).expect(201);
      await agent.get("/auth/me").expect(401);
      await agent.get("/status").expect(401);
    } finally {
      await app.close();
    }
  });

  it("logout repetido → 2º logout sem sessão válida é 401 (sem quebrar) e continua bloqueado", async () => {
    const { app, auth } = await freshApp();
    try {
      await auth.createOperator(EMAIL, PASSWORD);
      const fresh = request.agent(app.getHttpServer());
      const login = await fresh.post("/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(201);
      await fresh.post("/auth/logout").set("X-CSRF-Token", login.body.csrfToken).expect(201);
      await fresh.post("/auth/logout").set("X-CSRF-Token", login.body.csrfToken).expect(401); // sessão já revogada
      await fresh.get("/status").expect(401);
    } finally {
      await app.close();
    }
  });

  it("session fixation: dois logins geram tokens de sessão diferentes", async () => {
    const { app, auth } = await freshApp();
    try {
      await auth.createOperator(EMAIL, PASSWORD);
      const a = await request(app.getHttpServer()).post("/auth/login").send({ email: EMAIL, password: PASSWORD });
      const b = await request(app.getHttpServer()).post("/auth/login").send({ email: EMAIL, password: PASSWORD });
      const cookieA = a.headers["set-cookie"]?.[0] ?? "";
      const cookieB = b.headers["set-cookie"]?.[0] ?? "";
      expect(cookieA).not.toBe(cookieB);
    } finally {
      await app.close();
    }
  });

  it("SECURITY CLOSURE: revokeAllSessions derruba sessões ativas de todos os agents (sem endpoint HTTP)", async () => {
    const { app, auth } = await freshApp();
    try {
      await auth.createOperator(EMAIL, PASSWORD);
      const agentA = request.agent(app.getHttpServer());
      const agentB = request.agent(app.getHttpServer());
      await agentA.post("/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(201);
      await agentB.post("/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(201);
      await agentA.get("/auth/me").expect(200);
      await agentB.get("/auth/me").expect(200);
      await auth.revokeAllSessions(EMAIL, {});
      await agentA.get("/auth/me").expect(401);
      await agentB.get("/auth/me").expect(401);
    } finally {
      await app.close();
    }
  });
});

describe("S2 — matriz M2M em modo approved (fail-closed)", () => {
  let app: INestApplication;
  const KEY = "m2m-test-secret";

  beforeAll(async () => {
    const built = await buildApp({ GROWTHOS_MODE: "approved", GROWTHOS_API_KEY: KEY });
    app = built.app;
  });

  afterAll(async () => {
    delete process.env.GROWTHOS_MODE;
    delete process.env.GROWTHOS_API_KEY;
    await app.close();
  });

  it("rota shared /events sem chave → 401; com chave → 200 (M2M)", async () => {
    await request(app.getHttpServer()).post("/events").send({ eventId: "m2m-1", type: "sent" }).expect(401);
    const ok = await request(app.getHttpServer()).post("/events").set("X-Api-Key", KEY).send({ eventId: "m2m-1", type: "sent" }).expect(201);
    expect(ok.body.duplicate).toBe(false);
  });

  it("rota humana /status com chave M2M mas SEM sessão → 401 (chave não concede acesso humano)", async () => {
    await request(app.getHttpServer()).get("/status").set("X-Api-Key", KEY).expect(401);
  });

  it("rota pública /channels/health sem autenticação → 200 mesmo em approved", async () => {
    await request(app.getHttpServer()).get("/channels/health").expect(200);
  });

  it("CORS em approved sem allowlist não autoriza origem externa (fail-closed)", async () => {
    const res = await request(app.getHttpServer()).get("/channels/health").set("Origin", "http://evil.example").expect(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

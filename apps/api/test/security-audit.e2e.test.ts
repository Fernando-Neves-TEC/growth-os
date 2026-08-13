/** S10 — eventos de segurança são produzidos, estruturados, persistidos, consultáveis e sem segredos. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createAuthedTest, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, type AuthedTest } from "./auth.helper.js";

/** Valores reais de segredo usados nesta suíte — NENHUM pode aparecer em evento de auditoria. */
const SECRET_VALUES = [TEST_ADMIN_PASSWORD, "SenhaErrada1", "SenhaInativa1!", "m2m-test-secret"];

describe("S10 — observabilidade de segurança", () => {
  let t: AuthedTest;

  beforeAll(async () => {
    t = await createAuthedTest();
  });

  afterAll(async () => {
    await t.app.close();
  });

  function noSecrets(events: unknown[]): void {
    for (const ev of events) {
      const blob = JSON.stringify(ev);
      // nenhum valor de segredo real aparece
      for (const s of SECRET_VALUES) {
        expect(blob).not.toContain(s);
      }
      // nenhuma conexão/connection string
      expect(blob).not.toMatch(/postgres:\/\/|connectionstring/i);
      // nenhuma chave/metadado sensível (só reason/email/type/etc.)
      const meta = (ev as { metadata?: Record<string, unknown> }).metadata ?? {};
      for (const key of Object.keys(meta)) {
        expect(key.toLowerCase()).not.toMatch(/password|apikey|api_key|token|csrf|session|connection/);
      }
    }
  }

  it("produz AUTH_LOGIN_SUCCESS (login do helper) e é consultável via /security/audit", async () => {
    const res = await t.agent.get("/security/audit").expect(200);
    expect(res.body.some((e: { event: string }) => e.event === "AUTH_LOGIN_SUCCESS")).toBe(true);
    noSecrets(res.body);
  });

  it("login falho → AUTH_LOGIN_FAILURE (redigido)", async () => {
    await request(t.app.getHttpServer()).post("/auth/login").send({ email: TEST_ADMIN_EMAIL, password: "SenhaErrada1" }).expect(401);
    const res = await t.agent.get("/security/audit").expect(200);
    expect(res.body.some((e: { event: string }) => e.event === "AUTH_LOGIN_FAILURE")).toBe(true);
    noSecrets(res.body);
  });

  it("logout → AUTH_LOGOUT", async () => {
    const fresh = request.agent(t.app.getHttpServer());
    const login = await fresh.post("/auth/login").send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }).expect(201);
    await fresh.post("/auth/logout").set("X-CSRF-Token", login.body.csrfToken).expect(201);
    const res = await t.agent.get("/security/audit").expect(200);
    expect(res.body.some((e: { event: string }) => e.event === "AUTH_LOGOUT")).toBe(true);
    noSecrets(res.body);
  });

  it("sessão inválida → AUTH_SESSION_INVALID", async () => {
    await request(t.app.getHttpServer()).get("/auth/me").set("Cookie", "growthos_session=token-bogus-aleatorio").expect(401);
    const res = await t.agent.get("/security/audit").expect(200);
    expect(res.body.some((e: { event: string }) => e.event === "AUTH_SESSION_INVALID")).toBe(true);
    noSecrets(res.body);
  });

  it("rota proibida (CSRF ausente em mutação autenticada) → AUTHORIZATION_DENIED", async () => {
    await t.agent.post("/channels/pause").send({ reason: "x" }).expect(403);
    const res = await t.agent.get("/security/audit").expect(200);
    expect(res.body.some((e: { event: string }) => e.event === "AUTHORIZATION_DENIED")).toBe(true);
    noSecrets(res.body);
  });

  it("eventos não contêm senha/API key/sessão/CSRF/connection string (redaction em toda a lista)", async () => {
    // gera mais um login (metadados com email/operador) e valida redação de toda a lista
    await request(t.app.getHttpServer()).post("/auth/login").send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }).expect(201);
    const res = await t.agent.get("/security/audit?limit=500").expect(200);
    noSecrets(res.body);
  });
});

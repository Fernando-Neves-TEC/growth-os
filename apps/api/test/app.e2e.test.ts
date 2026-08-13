import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";

const validWorkflow = {
  id: "wf-api",
  version: 1,
  name: "funil api",
  entry: "s1",
  nodes: [
    { id: "s1", type: "send", config: { channel: "whatsapp", body: "Olá!" } },
    { id: "c1", type: "condition", config: { branches: { interest: "s2", optout: "out" }, default: "out" } },
    { id: "s2", type: "send", config: { channel: "email", body: "Detalhes." } },
    { id: "out", type: "optout" },
  ],
  edges: [
    { from: "s1", to: "c1" },
    { from: "c1", to: "s2", on: "interest" },
    { from: "c1", to: "out", on: "optout" },
  ],
};

describe("Growth OS API (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /campaigns começa vazio", async () => {
    const res = await request(app.getHttpServer()).get("/campaigns").expect(200);
    expect(res.body).toEqual([]);
  });

  it("GET /channels/health está saudável sem dados (sem kill-switch)", async () => {
    const res = await request(app.getHttpServer()).get("/channels/health").expect(200);
    expect(res.body.killSwitch).toBe(false);
    expect(res.body.status).toBe("healthy");
  });

  it("POST /campaigns cria campanha com workflow válido", async () => {
    const res = await request(app.getHttpServer())
      .post("/campaigns")
      .send({ name: "fisio", workflow: validWorkflow })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe("draft");
  });

  it("POST /campaigns rejeita workflow inválido (fail-closed)", async () => {
    const res = await request(app.getHttpServer())
      .post("/campaigns")
      .send({ name: "bad", workflow: { ...validWorkflow, entry: "inexistente" } })
      .expect(400);
    expect(res.body.message).toContain("workflow inválido");
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it("POST /campaigns/:id/plan-day planeja com warm-up", async () => {
    const created = await request(app.getHttpServer()).post("/campaigns").send({ name: "p", workflow: validWorkflow }).expect(201);
    const leads = Array.from({ length: 20 }, (_, i) => ({ leadId: `l${i}`, channel: "whatsapp", body: `m${i}` }));
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${created.body.id}/plan-day`)
      .send({ leads, dayIndex: 0 })
      .expect(201);
    // dia 0 → warmupDay1 = 10 (padrão)
    expect(res.body.plan.sends.length).toBeLessThanOrEqual(10);
  });

  it("POST /campaigns/:id/simulate-turn roda a state machine", async () => {
    const created = await request(app.getHttpServer()).post("/campaigns").send({ name: "s", workflow: validWorkflow }).expect(201);
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${created.body.id}/simulate-turn`)
      .send({ event: { type: "start" }, currentNode: null })
      .expect(201);
    expect(res.body.actions[0].type).toBe("send");
  });

  it("GET /channels/health reflete envio sem entrega como crítico", async () => {
    const res = await request(app.getHttpServer()).get("/channels/health").expect(200);
    // após plan-day: sent>0 e delivered=0 → canal crítico (autopausa)
    expect(res.body.killSwitch).toBe(true);
  });

  it("kill-switch pausa e bloqueia planejamento (fail-closed)", async () => {
    const created = await request(app.getHttpServer()).post("/campaigns").send({ name: "k", workflow: validWorkflow }).expect(201);
    await request(app.getHttpServer()).post("/channels/pause").send({ reason: "rejeicao_alta" }).expect(201);
    await request(app.getHttpServer())
      .post(`/campaigns/${created.body.id}/plan-day`)
      .send({ leads: [{ leadId: "x", channel: "whatsapp", body: "oi" }], dayIndex: 0 })
      .expect(409);
    await request(app.getHttpServer()).post("/channels/resume").expect(201);
  });

  it("GET /metrics/funnel expõe ARR projetado", async () => {
    const res = await request(app.getHttpServer()).get("/metrics/funnel").expect(200);
    expect(typeof res.body.arr_projected).toBe("number");
  });
});

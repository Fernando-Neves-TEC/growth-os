import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import {
  CAMPAIGN_STORE,
  COUNTER_STORE,
  EVENT_STORE,
  KILL_SWITCH_STORE,
  MemoryCampaignStore,
  MemoryCounterStore,
  MemoryEventStore,
  MemoryKillSwitchStore,
  MemorySuppressionStore,
  SUPPRESSION_STORE,
} from "../src/persistence/stores.js";

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
    // e2e hermético: substitui as stores Postgres por implementações em memória.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KILL_SWITCH_STORE)
      .useValue(new MemoryKillSwitchStore())
      .overrideProvider(SUPPRESSION_STORE)
      .useValue(new MemorySuppressionStore())
      .overrideProvider(CAMPAIGN_STORE)
      .useValue(new MemoryCampaignStore())
      .overrideProvider(COUNTER_STORE)
      .useValue(new MemoryCounterStore())
      .overrideProvider(EVENT_STORE)
      .useValue(new MemoryEventStore())
      .compile();
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

  it("GET /channels/health expõe contrato no_data sem dados", async () => {
    const res = await request(app.getHttpServer()).get("/channels/health").expect(200);
    expect(res.body.killSwitch).toBe(false);
    expect(res.body.status).toBe("no_data");
    expect(res.body.score).toBeNull();
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

  it("GET /channels/health reflete envio sem entrega como crítico (via evento)", async () => {
    await request(app.getHttpServer()).post("/events").send({ eventId: "e-crit-1", type: "sent" }).expect(201);
    const res = await request(app.getHttpServer()).get("/channels/health").expect(200);
    // sent>0 e delivered=0 → canal crítico (autopausa)
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

  it("GET /metrics/funnel expõe ARR projetado e parâmetros parametrizados", async () => {
    const res = await request(app.getHttpServer()).get("/metrics/funnel").expect(200);
    expect(typeof res.body.arr_projected).toBe("number");
    expect(res.body.arr_params.scheduleRate).toBe(55);
    expect(res.body.arr_params.ticketMonthly).toBe(1500);
  });

  it("POST /events é idempotente (eventId único)", async () => {
    const body = { eventId: "evt-idem-1", type: "qualified" };
    const r1 = await request(app.getHttpServer()).post("/events").send(body).expect(201);
    expect(r1.body.duplicate).toBe(false);
    const r2 = await request(app.getHttpServer()).post("/events").send(body).expect(201);
    expect(r2.body.duplicate).toBe(true);
    const m = await request(app.getHttpServer()).get("/metrics/funnel").expect(200);
    expect(m.body.counters.qualified).toBe(1); // incrementado uma única vez
  });

  it("POST /events tipo optout adiciona à suppression", async () => {
    await request(app.getHttpServer())
      .post("/events")
      .send({ eventId: "evt-opt-1", type: "optout", cnpj: "55555555000188" })
      .expect(201);
    const res = await request(app.getHttpServer()).get("/suppression").expect(200);
    expect(res.body.some((s: { cnpj: string }) => s.cnpj === "55555555000188")).toBe(true);
  });

  it("POST/GET /suppression registra e lista opt-out", async () => {
    await request(app.getHttpServer())
      .post("/suppression")
      .send({ cnpj: "12.345.678/0001-90", reason: "auditoria" })
      .expect(201);
    const res = await request(app.getHttpServer()).get("/suppression").expect(200);
    expect(res.body.some((s: { cnpj: string }) => s.cnpj === "12345678000190")).toBe(true);
  });
});

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { executeCampaignRun, type CampaignRunInput } from "@growthos/core";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { WORKFLOW_LAUNCHER } from "../src/campaigns/workflow-launcher.js";
import { EventsService } from "../src/events/events.service.js";
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
  type KillSwitchStore,
  type SuppressionStore,
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
  let eventsService: EventsService;

  beforeAll(async () => {
    // e2e hermético: substitui as stores Postgres por implementações em memória COMPARTILHADAS
    // (o sink atômico de eventos precisa alcançar os mesmos counters/suppression que Metrics/Status leem).
    // H6: rate alto p/ não atrapalhar a suíte; body limit baixo p/ testar 413.
    process.env.GROWTHOS_RATE_LIMIT_MAX = "100000";
    process.env.GROWTHOS_BODY_LIMIT = "4kb";
    const counterStore = new MemoryCounterStore();
    const suppressionStore = new MemorySuppressionStore();
    const killSwitchStore = new MemoryKillSwitchStore();
    const campaignStore = new MemoryCampaignStore();
    const leadStore = new MemoryLeadStore();
    // Fake launcher determinístico (C1): executa o MESMO executor puro do core usado pelo
    // workflow Temporal, com activities ligadas às stores reais e ao EventsService real.
    const fakeLauncher = {
      launch: async (input: CampaignRunInput) => {
        const outcome = await executeCampaignRun(input, {
          getKillSwitch: () => killSwitchStore.get(),
          isSuppressed: async (cnpj) => ({ suppressed: await suppressionStore.contains(cnpj) }),
          sendMessage: async () => ({ delivered: true, read: true, replied: true }),
          recordEvent: (e) => eventsService.process(e),
        });
        return { workflowId: `fake-${input.campaignId}` };
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KILL_SWITCH_STORE)
      .useValue(killSwitchStore)
      .overrideProvider(SUPPRESSION_STORE)
      .useValue(suppressionStore)
      .overrideProvider(CAMPAIGN_STORE)
      .useValue(campaignStore)
      .overrideProvider(COUNTER_STORE)
      .useValue(counterStore)
      .overrideProvider(EVENT_STORE)
      .useValue(new MemoryEventStore({ counters: counterStore, suppression: suppressionStore }))
      .overrideProvider(LEAD_STORE)
      .useValue(leadStore)
      .overrideProvider(WORKFLOW_LAUNCHER)
      .useValue(fakeLauncher)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    eventsService = moduleRef.get(EventsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /campaigns começa vazio", async () => {
    const res = await request(app.getHttpServer()).get("/campaigns").expect(200);
    expect(res.body).toEqual([]);
  });

  it("GET /leads começa vazio (sem runs de pipeline)", async () => {
    const res = await request(app.getHttpServer()).get("/leads").expect(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
    const runs = await request(app.getHttpServer()).get("/leads/runs").expect(200);
    expect(runs.body).toEqual([]);
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

  it("GET /status expõe observabilidade consolidada", async () => {
    const res = await request(app.getHttpServer()).get("/status").expect(200);
    expect(res.body.mode).toBeDefined();
    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(res.body.leads).toBe(0);
    expect(typeof res.body.health.status).toBe("string");
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

  it("POST /events é idempotente (eventId único, efeito único)", async () => {
    const before = (await request(app.getHttpServer()).get("/metrics/funnel").expect(200)).body.counters.sent;
    const body = { eventId: "evt-idem-1", type: "sent" };
    const r1 = await request(app.getHttpServer()).post("/events").send(body).expect(201);
    expect(r1.body.duplicate).toBe(false);
    const r2 = await request(app.getHttpServer()).post("/events").send(body).expect(201);
    expect(r2.body.duplicate).toBe(true);
    const m = await request(app.getHttpServer()).get("/metrics/funnel").expect(200);
    expect(m.body.counters.sent).toBe(before + 1); // incrementado uma única vez (delta)
  });

  it("POST /events rejeita evento fora de ordem com 422 (invariante do funil)", async () => {
    await request(app.getHttpServer()).post("/events").send({ eventId: "inv-sent", type: "sent" }).expect(201);
    const res = await request(app.getHttpServer())
      .post("/events")
      .send({ eventId: "inv-read", type: "read" })
      .expect(422);
    expect(res.body.code).toBe("FUNNEL_INVARIANT");
    // nada foi incrementado (evento não persistido)
    const m = await request(app.getHttpServer()).get("/metrics/funnel").expect(200);
    expect(m.body.counters.read).toBe(0);
  });

  it("POST /events tipo optout adiciona à suppression", async () => {
    await request(app.getHttpServer())
      .post("/events")
      .send({ eventId: "evt-opt-1", type: "optout", cnpj: "11222333000181" })
      .expect(201);
    const res = await request(app.getHttpServer()).get("/suppression").expect(200);
    expect(res.body.some((s: { cnpj: string }) => s.cnpj === "11222333000181")).toBe(true);
  });

  it("POST/GET /suppression registra e lista opt-out", async () => {
    await request(app.getHttpServer())
      .post("/suppression")
      .send({ cnpj: "12.345.678/0001-95", reason: "auditoria" })
      .expect(201);
    const res = await request(app.getHttpServer()).get("/suppression").expect(200);
    expect(res.body.some((s: { cnpj: string }) => s.cnpj === "12345678000195")).toBe(true);
  });

  it("POST /suppression rejeita CNPJ inválido (400)", async () => {
    await request(app.getHttpServer())
      .post("/suppression")
      .send({ cnpj: "12.345.678/0001-90" })
      .expect(400);
    const res = await request(app.getHttpServer()).get("/suppression").expect(200);
    expect(res.body.some((s: { cnpj: string }) => s.cnpj === "12345678000190")).toBe(false);
  });

  it("CAMINHO PRINCIPAL: criar → iniciar via API → workflow → suppression → eventos → contadores → métricas (C1)", async () => {
    // seed: lead-0 será suprimido (CNPJ válido e não usado por outros leads)
    await request(app.getHttpServer()).post("/suppression").send({ cnpj: "00000000000191" }).expect(201);
    const created = await request(app.getHttpServer()).post("/campaigns").send({ name: "main", workflow: validWorkflow }).expect(201);
    const before = (await request(app.getHttpServer()).get("/metrics/funnel").expect(200)).body.counters;
    const plans = [
      { leadId: "main-lead-0", cnpj: "00000000000191", channel: "whatsapp", body: "abordagem 0" },
      { leadId: "main-lead-1", cnpj: "00000000000272", channel: "whatsapp", body: "abordagem 1" },
      { leadId: "main-lead-2", cnpj: "00000000000353", channel: "whatsapp", body: "abordagem 2" },
    ];
    const start = await request(app.getHttpServer())
      .post(`/campaigns/${created.body.id}/start`)
      .send({ plans })
      .expect(201);
    expect(start.body.status).toBe("active");
    expect(start.body.workflowId).toBe(`fake-${created.body.id}`);
    const after = (await request(app.getHttpServer()).get("/metrics/funnel").expect(200)).body.counters;
    // 3 plans → 2 enviados (lead-0 suppressido) × (sent+delivered+read+replied)
    expect(after.sent).toBe(before.sent + 2);
    expect(after.delivered).toBe(before.delivered + 2);
    expect(after.read).toBe(before.read + 2);
    expect(after.replied).toBe(before.replied + 2);
    // status ativo e visível no dashboard (GET /campaigns/:id)
    const detail = await request(app.getHttpServer()).get(`/campaigns/${created.body.id}`).expect(200);
    expect(detail.body.status).toBe("active");
    // dashboard consegue consultar resultado consolidado
    const st = await request(app.getHttpServer()).get("/status").expect(200);
    expect(st.body.leads).toBeGreaterThanOrEqual(0);
  });

  it("POST /campaigns/:id/start em campanha inexistente → 404 (H3)", async () => {
    await request(app.getHttpServer())
      .post("/campaigns/00000000-0000-4000-8000-000000000000/start")
      .send({ plans: [{ leadId: "l", channel: "whatsapp", body: "oi" }] })
      .expect(404);
  });

  it("POST /campaigns/:id/start rejeita plans inválidos (400)", async () => {
    const created = await request(app.getHttpServer()).post("/campaigns").send({ name: "p2", workflow: validWorkflow }).expect(201);
    await request(app.getHttpServer()).post(`/campaigns/${created.body.id}/start`).send({ plans: [] }).expect(400);
    await request(app.getHttpServer())
      .post(`/campaigns/${created.body.id}/start`)
      .send({ plans: [{ leadId: "l", channel: "sms", body: "oi" }] })
      .expect(400);
  });

  it("POST /campaigns/:id/start bloqueado pelo kill-switch → 409 (fail-closed)", async () => {
    const created = await request(app.getHttpServer()).post("/campaigns").send({ name: "p3", workflow: validWorkflow }).expect(201);
    await request(app.getHttpServer()).post("/channels/pause").send({ reason: "test" }).expect(201);
    await request(app.getHttpServer())
      .post(`/campaigns/${created.body.id}/start`)
      .send({ plans: [{ leadId: "l", channel: "whatsapp", body: "oi" }] })
      .expect(409);
    await request(app.getHttpServer()).post("/channels/resume").expect(201);
  });

  it("H3: GET /campaigns/:id inexistente (UUID válido) → 404", async () => {
    await request(app.getHttpServer()).get("/campaigns/00000000-0000-4000-8000-000000000000").expect(404);
  });

  it("H3: GET /campaigns/:id com UUID inválido → 404 (não 500)", async () => {
    await request(app.getHttpServer()).get("/campaigns/nao-e-um-uuid").expect(404);
  });

  it("H3: plan-day em campanha inexistente → 404", async () => {
    await request(app.getHttpServer())
      .post("/campaigns/00000000-0000-4000-8000-000000000000/plan-day")
      .send({ leads: [{ leadId: "l", channel: "whatsapp", body: "oi" }] })
      .expect(404);
  });

  it("H4: validação estruturada — evento com tipo inválido → 400 com erros", async () => {
    const res = await request(app.getHttpServer())
      .post("/events")
      .send({ eventId: "e-bad-1", type: "nao-existe" })
      .expect(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it("H4: validação estruturada — campanha sem name → 400", async () => {
    await request(app.getHttpServer()).post("/campaigns").send({ workflow: validWorkflow }).expect(400);
  });

  it("H4: validação estruturada — query inválida em /leads → 400", async () => {
    await request(app.getHttpServer()).get("/leads?limit=abc").expect(400);
  });

  it("H6: payload acima do limite de body → 413", async () => {
    const big = "x".repeat(8 * 1024);
    await request(app.getHttpServer())
      .post("/events")
      .send({ eventId: "big-1", type: "sent", cnpj: big })
      .expect(413);
  });
});

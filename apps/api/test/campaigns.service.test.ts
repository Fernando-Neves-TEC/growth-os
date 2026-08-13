import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { loadConfig, type CampaignRunInput } from "@growthos/core";
import { CampaignsService } from "../src/campaigns/campaigns.service.js";
import { MemoryCampaignStore, MemoryCounterStore, MemoryKillSwitchStore } from "../src/persistence/stores.js";

const okWorkflow = {
  id: "w",
  version: 1,
  name: "n",
  entry: "s",
  nodes: [
    { id: "s", type: "send", config: { channel: "whatsapp", body: "oi" } },
    { id: "e", type: "end" },
  ],
  edges: [{ from: "s", to: "e" }],
};

describe("CampaignsService (unit)", () => {
  let campaigns: MemoryCampaignStore;
  let killSwitch: MemoryKillSwitchStore;
  let service: CampaignsService;
  const launched: CampaignRunInput[] = [];

  beforeEach(() => {
    campaigns = new MemoryCampaignStore();
    killSwitch = new MemoryKillSwitchStore();
    launched.length = 0;
    service = new CampaignsService(campaigns, killSwitch, loadConfig({}), {
      launch: async (input) => {
        launched.push(input);
        return { workflowId: `wf-${input.campaignId}` };
      },
    });
  });

  it("cria campanha a partir de workflow válido", async () => {
    const rec = await service.create({ name: "x", workflow: okWorkflow });
    expect((await campaigns.get(rec.id))?.id).toBe(rec.id);
  });

  it("lança 400 para workflow sem terminal", async () => {
    const noTerminal = {
      ...okWorkflow,
      nodes: [{ id: "s", type: "send", config: { channel: "whatsapp", body: "oi" } }],
    };
    await expect(service.create({ name: "x", workflow: noTerminal })).rejects.toThrow(BadRequestException);
  });

  it("planeja dia respeitando o teto de warm-up", async () => {
    const rec = await service.create({ name: "x", workflow: okWorkflow });
    const leads = Array.from({ length: 50 }, (_, i) => ({ leadId: `l${i}`, channel: "whatsapp" as const, body: `m${i}` }));
    const { plan } = await service.planDay(rec.id, { leads, dayIndex: 0 });
    expect(plan.sends.length).toBeLessThanOrEqual(10); // warmupDay1
    expect(plan.sends.length + plan.skipped.length).toBe(50);
  });

  it("bloqueia plan-day quando o kill-switch está pausado (fail-closed)", async () => {
    const rec = await service.create({ name: "x", workflow: okWorkflow });
    await killSwitch.set({ paused: true, reason: "rejeicao_alta" });
    await expect(service.planDay(rec.id, { leads: [{ leadId: "l", channel: "whatsapp", body: "m" }], dayIndex: 0 })).rejects.toThrow(
      /kill-switch/,
    );
  });

  it("start ativa campanha e lança workflow com o plano (C1)", async () => {
    const rec = await service.create({ name: "x", workflow: okWorkflow });
    const res = await service.start(rec.id, {
      plans: [
        { leadId: "l1", channel: "whatsapp", body: "oi" },
        { leadId: "l2", channel: "whatsapp", body: "olá" },
      ],
    });
    expect(res.status).toBe("active");
    expect(res.workflowId).toBe(`wf-${rec.id}`);
    expect(launched.length).toBe(1);
    expect(launched[0].campaignId).toBe(rec.id);
    expect(launched[0].plans.length).toBe(2);
    expect((await campaigns.get(rec.id))?.status).toBe("active");
  });

  it("start rejeita plano vazio (400)", async () => {
    const rec = await service.create({ name: "x", workflow: okWorkflow });
    await expect(service.start(rec.id, { plans: [] })).rejects.toThrow(BadRequestException);
    expect(launched.length).toBe(0);
  });

  it("start bloqueado quando kill-switch pausado (fail-closed) sem lançar workflow", async () => {
    const rec = await service.create({ name: "x", workflow: okWorkflow });
    await killSwitch.set({ paused: true, reason: "x" });
    await expect(service.start(rec.id, { plans: [{ leadId: "l", channel: "whatsapp", body: "oi" }] })).rejects.toThrow(/kill-switch/);
    expect(launched.length).toBe(0);
  });
});

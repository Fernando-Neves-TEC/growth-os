import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "@growthos/core";
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
  let counters: MemoryCounterStore;
  let killSwitch: MemoryKillSwitchStore;
  let service: CampaignsService;

  beforeEach(() => {
    campaigns = new MemoryCampaignStore();
    counters = new MemoryCounterStore();
    killSwitch = new MemoryKillSwitchStore();
    service = new CampaignsService(campaigns, counters, killSwitch, loadConfig({}));
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
});

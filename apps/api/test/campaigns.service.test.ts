import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "@growthos/core";
import { CampaignsService } from "../src/campaigns/campaigns.service.js";
import { InMemoryStore } from "../src/store/in-memory.store.js";

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
  let store: InMemoryStore;
  let service: CampaignsService;

  beforeEach(() => {
    store = new InMemoryStore();
    service = new CampaignsService(store, loadConfig({}));
  });

  it("cria campanha a partir de workflow válido", () => {
    const rec = service.create({ name: "x", workflow: okWorkflow });
    expect(store.campaigns.has(rec.id)).toBe(true);
  });

  it("lança 400 para workflow sem terminal", () => {
    const noTerminal = {
      ...okWorkflow,
      nodes: [{ id: "s", type: "send", config: { channel: "whatsapp", body: "oi" } }],
    };
    expect(() => service.create({ name: "x", workflow: noTerminal })).toThrow(BadRequestException);
  });

  it("planeja dia respeitando o teto de warm-up", () => {
    const rec = service.create({ name: "x", workflow: okWorkflow });
    const leads = Array.from({ length: 50 }, (_, i) => ({ leadId: `l${i}`, channel: "whatsapp" as const, body: `m${i}` }));
    const { plan } = service.planDay(rec.id, { leads, dayIndex: 0 });
    expect(plan.sends.length).toBeLessThanOrEqual(10); // warmupDay1
    expect(plan.sends.length + plan.skipped.length).toBe(50);
  });
});

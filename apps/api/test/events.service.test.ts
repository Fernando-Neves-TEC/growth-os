import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { EventsService } from "../src/events/events.service.js";
import { MemoryCounterStore, MemoryEventStore, MemorySuppressionStore } from "../src/persistence/stores.js";

describe("EventsService (unit)", () => {
  let events: MemoryEventStore;
  let counters: MemoryCounterStore;
  let suppression: MemorySuppressionStore;
  let service: EventsService;

  beforeEach(() => {
    events = new MemoryEventStore();
    counters = new MemoryCounterStore();
    suppression = new MemorySuppressionStore();
    service = new EventsService(events, counters, suppression);
  });

  it("incrementa contador uma única vez por eventId (idempotente)", async () => {
    const body = { eventId: "e1", type: "delivered" as const };
    const r1 = await service.process(body);
    const r2 = await service.process(body);
    expect(r1.duplicate).toBe(false);
    expect(r2.duplicate).toBe(true);
    const state = await counters.get();
    expect(state.counters.delivered).toBe(1);
  });

  it("evento optout adiciona à suppression", async () => {
    await service.process({ eventId: "o1", type: "optout", cnpj: "12345678000190" });
    expect(await suppression.contains("12345678000190")).toBe(true);
  });

  it("rejeita optout sem cnpj", async () => {
    await expect(service.process({ eventId: "o2", type: "optout" })).rejects.toThrow(BadRequestException);
  });

  it("rejeita tipo de evento inválido", async () => {
    await expect(service.process({ eventId: "x", type: "fake" as never })).rejects.toThrow(BadRequestException);
  });

  it("rejeita eventId ausente", async () => {
    await expect(service.process({ eventId: "", type: "sent" })).rejects.toThrow(BadRequestException);
  });
});

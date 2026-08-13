import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { EventsService } from "../src/events/events.service.js";
import { MemoryCounterStore, MemoryEventStore, MemorySuppressionStore } from "../src/persistence/stores.js";

describe("EventsService (unit)", () => {
  let counters: MemoryCounterStore;
  let suppression: MemorySuppressionStore;
  let events: MemoryEventStore;
  let service: EventsService;

  beforeEach(() => {
    counters = new MemoryCounterStore();
    suppression = new MemorySuppressionStore();
    events = new MemoryEventStore({ counters, suppression });
    service = new EventsService(events);
  });

  it("incrementa contador uma única vez por eventId (idempotente)", async () => {
    const body = { eventId: "e1", type: "sent" as const };
    const r1 = await service.process(body);
    const r2 = await service.process(body);
    expect(r1.duplicate).toBe(false);
    expect(r2.duplicate).toBe(true);
    const state = await counters.get();
    expect(state.counters.sent).toBe(1);
  });

  it("aplica a cadeia canônica do funil (invariantes respeitadas)", async () => {
    const chain = ["sent", "delivered", "read", "replied", "qualified", "scheduled", "closed"] as const;
    for (let i = 0; i < chain.length; i++) {
      await service.process({ eventId: `c${i}`, type: chain[i] });
    }
    const state = await counters.get();
    for (const t of chain) expect(state.counters[t]).toBe(1);
  });

  it("rejeita evento fora de ordem (invariante) sem alterar contadores", async () => {
    await service.process({ eventId: "s1", type: "sent" });
    await expect(service.process({ eventId: "r1", type: "read" })).rejects.toThrow(/read requer delivered/);
    const state = await counters.get();
    expect(state.counters.read).toBe(0);
    // eventId não consumido: retry corrigido pode reaplicar
    await service.process({ eventId: "d1", type: "delivered" });
    const r2 = await service.process({ eventId: "r1", type: "read" });
    expect(r2.duplicate).toBe(false);
  });

  it("não permite delivered acima de sent (taxas nunca > 100%)", async () => {
    await service.process({ eventId: "s1", type: "sent" });
    await service.process({ eventId: "d1", type: "delivered" });
    await expect(service.process({ eventId: "d2", type: "delivered" })).rejects.toThrow();
    const state = await counters.get();
    expect(state.counters.delivered).toBe(1);
    expect(state.counters.sent).toBe(1);
  });

  it("evento optout adiciona à suppression", async () => {
    await service.process({ eventId: "o1", type: "optout", cnpj: "12345678000195" });
    expect(await suppression.contains("12345678000195")).toBe(true);
  });

  it("rejeita optout sem cnpj", async () => {
    await expect(service.process({ eventId: "o2", type: "optout" })).rejects.toThrow(BadRequestException);
  });

  it("rejeita optout com CNPJ inválido", async () => {
    await expect(service.process({ eventId: "o3", type: "optout", cnpj: "12345678000190" })).rejects.toThrow(BadRequestException);
  });

  it("rejeita tipo de evento inválido", async () => {
    await expect(service.process({ eventId: "x", type: "fake" as never })).rejects.toThrow(BadRequestException);
  });

  it("rejeita eventId ausente", async () => {
    await expect(service.process({ eventId: "", type: "sent" })).rejects.toThrow(BadRequestException);
  });
});

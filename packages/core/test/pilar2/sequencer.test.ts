import { describe, expect, it } from "vitest";
import { Sequencer } from "../../src/pilar2/sequencer.js";
import type { AntiBanPolicy } from "../../src/pilar2/anti-ban.js";

const policy: AntiBanPolicy = {
  warmupDay1: 3,
  warmupStep: 2,
  warmupCeiling: 10,
  businessHoursStart: 9,
  businessHoursEnd: 18,
  jitterMinMs: 0,
  jitterMaxMs: 0, // sem jitter → determinístico nos testes
};

const rngZero = () => 0;

function makeLeads(n: number, channel: "whatsapp" | "email"): { leadId: string; channel: "whatsapp" | "email"; body: string }[] {
  return Array.from({ length: n }, (_, i) => ({
    leadId: `lead-${i}`,
    channel,
    body: `msg ${i}`,
  }));
}

describe("Sequencer (S4)", () => {
  it("respeita o limite diário por canal (warm-up)", () => {
    const seq = new Sequencer(policy, rngZero);
    const plan = seq.planDay(makeLeads(10, "whatsapp"), 0, new Date(2026, 0, 5, 8, 0));
    expect(plan.sends.length).toBe(3); // dia 0 → limite 3
    expect(plan.skipped.length).toBe(7);
  });

  it("limita cada canal de forma independente", () => {
    const seq = new Sequencer(policy, rngZero);
    const leads = [...makeLeads(5, "whatsapp"), ...makeLeads(5, "email")];
    const plan = seq.planDay(leads, 0, new Date(2026, 0, 5, 8, 0));
    // 3 por canal = 6
    expect(plan.sends.length).toBe(6);
  });

  it("espalha dentro da janela comercial", () => {
    const seq = new Sequencer(policy, rngZero);
    const plan = seq.planDay(makeLeads(3, "whatsapp"), 0, new Date(2026, 0, 5, 8, 0));
    for (const s of plan.sends) {
      const h = s.scheduledAt.getHours();
      expect(h).toBeGreaterThanOrEqual(9);
      expect(h).toBeLessThan(18);
    }
  });

  it("o warm-up cresce no dia seguinte", () => {
    const seq = new Sequencer(policy, rngZero);
    const day0 = seq.planDay(makeLeads(10, "whatsapp"), 0, new Date(2026, 0, 5, 8, 0));
    const day1 = seq.planDay(makeLeads(10, "whatsapp"), 1, new Date(2026, 0, 6, 8, 0));
    expect(day1.sends.length).toBeGreaterThan(day0.sends.length);
  });
});

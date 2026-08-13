import { describe, expect, it } from "vitest";
import {
  checkDailyRate,
  isBusinessHour,
  jitterDelayMs,
  warmupLimit,
  type AntiBanPolicy,
} from "../../src/pilar2/anti-ban.js";

const policy: AntiBanPolicy = {
  warmupDay1: 10,
  warmupStep: 5,
  warmupCeiling: 100,
  businessHoursStart: 9,
  businessHoursEnd: 18,
  jitterMinMs: 15_000,
  jitterMaxMs: 45_000,
};

describe("anti-ban (S4)", () => {
  it("warm-up cresce e para no teto", () => {
    expect(warmupLimit(policy, 0)).toBe(10);
    expect(warmupLimit(policy, 1)).toBe(15);
    expect(warmupLimit(policy, 30)).toBe(100);
  });

  it("limite diário falha-closed ao atingir o teto", () => {
    expect(checkDailyRate(policy, 0, 9).allowed).toBe(true);
    const r = checkDailyRate(policy, 0, 10);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("limite_diario_atingido");
  });

  it("jitter respeita a janela [min, max]", () => {
    for (let i = 0; i < 50; i++) {
      const d = jitterDelayMs(policy, () => 1); // rng=1 → máximo
      expect(d).toBeGreaterThanOrEqual(policy.jitterMinMs);
      expect(d).toBeLessThanOrEqual(policy.jitterMaxMs);
    }
  });

  it("janela comercial respeita start/end", () => {
    expect(isBusinessHour(9, policy)).toBe(true);
    expect(isBusinessHour(17, policy)).toBe(true);
    expect(isBusinessHour(18, policy)).toBe(false);
    expect(isBusinessHour(8, policy)).toBe(false);
  });
});

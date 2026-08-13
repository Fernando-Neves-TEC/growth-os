import { describe, expect, it } from "vitest";
import { ConfigValidationError, loadConfig } from "../../src/s0/config.js";

describe("loadConfig (S0 — fail-closed)", () => {
  it("aplica padrões quando o ambiente está vazio", () => {
    const cfg = loadConfig({});
    expect(cfg.mode).toBe("simulation");
    expect(cfg.leadMaxVolumePerDay).toBe(100);
    expect(cfg.agentQualifyThreshold).toBe(70);
  });

  it("nunca assume modo approved sem env explícito", () => {
    expect(loadConfig({}).mode).not.toBe("approved");
  });

  it("lê limites de volume e warm-up do ambiente", () => {
    const cfg = loadConfig({
      LEAD_MAX_VOLUME_PER_DAY: "80",
      SEQUENCER_WARMUP_DAY1: "5",
    });
    expect(cfg.leadMaxVolumePerDay).toBe(80);
    expect(cfg.sequencerWarmupDay1).toBe(5);
  });

  it("rejeita volume fora do teto seguro (fail-closed)", () => {
    expect(() => loadConfig({ LEAD_MAX_VOLUME_PER_DAY: "99999" })).toThrow(ConfigValidationError);
  });

  it("parseia listas de ICP", () => {
    const cfg = loadConfig({ ICP_CNAE_ALLOWLIST: "6911701, 8610101" });
    expect(cfg.icpCnaeAllowlist).toEqual(["6911701", "8610101"]);
  });

  it("parametriza ARR com padrões seguros", () => {
    const cfg = loadConfig({});
    expect(cfg.arrScheduleRate).toBe(55);
    expect(cfg.arrCloseRate).toBe(20);
    expect(cfg.arrTicketMonthly).toBe(1500);
  });
});

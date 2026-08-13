import { describe, expect, it } from "vitest";
import { evaluateAlerts, KillSwitch } from "../../src/pilar4/alerts.js";
import { channelHealth } from "../../src/pilar4/health.js";

const healthy = {
  delivered: 100,
  sent: 100,
  rejected: 0,
  readRate: 70,
  replyRate: 40,
  channelMin: 60,
  rejectionRateMax: 5,
};

describe("channelHealth + KillSwitch (S7)", () => {
  it("canal saudável não dispara kill-switch", () => {
    const h = channelHealth(healthy);
    expect(h.status).toBe("healthy");
    expect(h.killSwitch).toBe(false);
  });

  it("rejeição acima do limite dispara kill-switch (fail-closed)", () => {
    const h = channelHealth({ ...healthy, sent: 100, rejected: 12, delivered: 90 });
    expect(h.rejectionRate).toBe(12);
    expect(h.status).toBe("critical");
    expect(h.killSwitch).toBe(true);
    expect(h.reasons.some((r) => r.startsWith("rejeicao"))).toBe(true);
  });

  it("score abaixo do mínimo dispara kill-switch", () => {
    const h = channelHealth({ ...healthy, delivered: 10, sent: 100, readRate: 10, replyRate: 5 });
    expect(h.killSwitch).toBe(true);
  });

  it("alerta crítico é emitido quando o canal está crítico", () => {
    const h = channelHealth({ ...healthy, rejected: 20, sent: 100 });
    const alerts = evaluateAlerts(h, "camp-1");
    expect(alerts.some((a) => a.level === "critical" && a.rule === "kill_switch")).toBe(true);
  });

  it("canal sem dados (sent=0) não dispara kill-switch e expõe no_data", () => {
    const h = channelHealth({ ...healthy, sent: 0, delivered: 0 });
    expect(h.status).toBe("no_data");
    expect(h.score).toBeNull();
    expect(h.killSwitch).toBe(false);
  });

  it("kill-switch pausa e requer retomada explícita", () => {
    const ks = new KillSwitch();
    expect(ks.isPaused).toBe(false);
    ks.pause("rejeicao_acima_do_limite");
    expect(ks.isPaused).toBe(true);
    expect(ks.reason).toBe("rejeicao_acima_do_limite");
    ks.resume();
    expect(ks.isPaused).toBe(false);
  });
});

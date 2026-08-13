import { describe, expect, it } from "vitest";
import { arrProjected, funnelMetrics, type FunnelCounters } from "../../src/pilar4/metrics.js";

const base: FunnelCounters = {
  sent: 225,
  delivered: 225,
  read: 120,
  replied: 45,
  qualified: 18,
  scheduled: 10,
  closed: 2,
  rejected: 0,
};

describe("funnelMetrics (S7)", () => {
  it("calcula taxas do funil", () => {
    const m = funnelMetrics(base);
    expect(m.deliveryRate).toBe(100);
    expect(m.replyRate).toBeCloseTo(37.5, 1); // 45/120
    expect(m.closeRate).toBeCloseTo(20, 1); // 2/10
  });

  it("evita divisão por zero", () => {
    const m = funnelMetrics({ ...base, sent: 0, delivered: 0, read: 0, replied: 0 });
    expect(m.deliveryRate).toBe(0);
  });

  it("projeta ARR do cenário âncora (225 → 2 clientes, ticket R$ 1.500)", () => {
    // qualified=18, schedule 55%, close 20%, ticket 1500
    // valor esperado: 18*0.55*0.20 = 1,98 clientes → 1,98*1500*12 = R$ 35.640
    const arr = arrProjected(18, 55, 20, 1500);
    expect(arr).toBeCloseTo(35_640, 0);
  });
});

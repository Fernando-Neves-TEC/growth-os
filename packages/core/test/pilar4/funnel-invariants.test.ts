import { describe, expect, it } from "vitest";
import { assertFunnelInvariant, FUNNEL_PRECEDENCE, type FunnelCounters } from "../../src/pilar4/metrics.js";

const zero = (): FunnelCounters => ({
  sent: 0, delivered: 0, read: 0, replied: 0, qualified: 0, scheduled: 0, closed: 0, rejected: 0,
});

describe("assertFunnelInvariant (contrato do funil)", () => {
  it("sent não exige predecessor (sempre permitido)", () => {
    expect(assertFunnelInvariant(zero(), "sent").ok).toBe(true);
  });

  it("delivered exige sent > 0", () => {
    expect(assertFunnelInvariant(zero(), "delivered").ok).toBe(false);
    const c = zero(); c.sent = 1;
    expect(assertFunnelInvariant(c, "delivered").ok).toBe(true);
  });

  it("read exige delivered > 0 e read < delivered", () => {
    const c = zero(); c.sent = 1; c.delivered = 0;
    expect(assertFunnelInvariant(c, "read").ok).toBe(false);
    c.delivered = 1;
    expect(assertFunnelInvariant(c, "read").ok).toBe(true);
    c.read = 1;
    expect(assertFunnelInvariant(c, "read").ok).toBe(false); // read não pode exceder delivered
  });

  it("replied exige read e nunca excede read", () => {
    const c = zero(); c.sent = 1; c.delivered = 1; c.read = 1;
    expect(assertFunnelInvariant(c, "replied").ok).toBe(true);
    c.replied = 1;
    expect(assertFunnelInvariant(c, "replied").ok).toBe(false);
  });

  it("cadeia completa closed requer scheduled → qualified → replied → read → delivered → sent", () => {
    const chain: (keyof FunnelCounters)[] = ["sent", "delivered", "read", "replied", "qualified", "scheduled", "closed"];
    const c = zero();
    for (const stage of chain) {
      const res = assertFunnelInvariant(c, stage as never);
      expect(res.ok).toBe(true);
      c[stage] = 1;
    }
    // sem parent, o primeiro da cadeia é rejeitado
    expect(assertFunnelInvariant(zero(), "closed").ok).toBe(false);
  });

  it("precedência está completa e sent é a raiz", () => {
    const stages = Object.keys(FUNNEL_PRECEDENCE);
    expect(stages).toEqual(["sent", "delivered", "read", "replied", "qualified", "scheduled", "closed"]);
    expect(FUNNEL_PRECEDENCE.sent).toBeNull();
    expect(FUNNEL_PRECEDENCE.delivered).toBe("sent");
    expect(FUNNEL_PRECEDENCE.closed).toBe("scheduled");
  });
});

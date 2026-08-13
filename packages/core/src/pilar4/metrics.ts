/** Métricas do funil e ARR projetado (Pilar 4). */
import type { Channel } from "../pilar2/types.js";

export type FunnelStage = "sent" | "delivered" | "read" | "replied" | "qualified" | "scheduled" | "closed";

/** Predecessor obrigatório de cada estágio do funil. `sent` não tem predecessor. */
export const FUNNEL_PRECEDENCE: Record<FunnelStage, FunnelStage | null> = {
  sent: null,
  delivered: "sent",
  read: "delivered",
  replied: "read",
  qualified: "replied",
  scheduled: "qualified",
  closed: "scheduled",
};

export type InvariantResult = { ok: true } | { ok: false; reason: string };

/** Valida se o estágio pode ser incrementado sobre os contadores atuais (contrato compartilhado).
 *  Regras: cada estágio exige predecessor > 0 e child <= parent (nunca exceder o pai).
 *  Eventos fora de ordem são REJEITADOS na ingestão — nunca mascarados no cálculo.
 */
export function assertFunnelInvariant(counters: FunnelCounters, stage: FunnelStage): InvariantResult {
  const parent = FUNNEL_PRECEDENCE[stage];
  if (!parent) return { ok: true }; // sent não tem predecessor
  const parentCount = counters[parent];
  const current = counters[stage];
  if (parentCount <= 0) {
    return { ok: false, reason: `${stage} requer ${parent} antes (${parent}=0)` };
  }
  if (current >= parentCount) {
    return { ok: false, reason: `${stage} (${current}) não pode exceder ${parent} (${parentCount})` };
  }
  return { ok: true };
}

export interface FunnelCounters {
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  qualified: number;
  scheduled: number;
  closed: number;
  rejected: number;
}

export interface FunnelMetrics {
  deliveryRate: number;
  readRate: number;
  replyRate: number;
  qualificationRate: number;
  scheduleRate: number;
  closeRate: number;
}

const pct = (a: number, b: number): number => (b > 0 ? (a / b) * 100 : 0);

export function funnelMetrics(c: FunnelCounters): FunnelMetrics {
  return {
    deliveryRate: pct(c.delivered, c.sent),
    readRate: pct(c.read, c.delivered),
    replyRate: pct(c.replied, c.read),
    qualificationRate: pct(c.qualified, c.replied),
    scheduleRate: pct(c.scheduled, c.qualified),
    closeRate: pct(c.closed, c.scheduled),
  };
}

/** ARR projetado: clientes esperados × ticket × 12 (com probabilidade de fechamento). */
export function arrProjected(qualified: number, scheduleRate: number, closeRate: number, ticketMonthly: number): number {
  const clients = qualified * (scheduleRate / 100) * (closeRate / 100);
  return clients * ticketMonthly * 12;
}

export interface ChannelCounters {
  channel: Channel;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  rejected: number;
}

export function channelRate(c: ChannelCounters): FunnelMetrics {
  return funnelMetrics({
    sent: c.sent,
    delivered: c.delivered,
    read: c.read,
    replied: c.replied,
    qualified: 0,
    scheduled: 0,
    closed: 0,
    rejected: c.rejected,
  });
}

/** Métricas do funil e ARR projetado (Pilar 4). */
import type { Channel } from "../pilar2/types.js";

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

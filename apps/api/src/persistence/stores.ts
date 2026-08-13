/** Contratos de persistência (Fase 3) + implementações em memória para testes.
 * A API depende das interfaces; produção usa impls Postgres; testes usam memória.
 */
import { Injectable } from "@nestjs/common";
import { assertFunnelInvariant, FunnelInvariantError, type FunnelCounters, type FunnelStage, type Workflow } from "@growthos/core";

// ---------- Kill-switch ----------
export interface KillSwitchState {
  paused: boolean;
  reason: string | null;
}

export interface KillSwitchStore {
  get(): Promise<KillSwitchState>;
  set(state: KillSwitchState): Promise<void>;
}

export const KILL_SWITCH_STORE = Symbol("KILL_SWITCH_STORE");

@Injectable()
export class MemoryKillSwitchStore implements KillSwitchStore {
  private state: KillSwitchState = { paused: false, reason: null };
  async get(): Promise<KillSwitchState> {
    return { ...this.state };
  }
  async set(state: KillSwitchState): Promise<void> {
    this.state = { ...state };
  }
}

// ---------- Suppression ----------
export interface SuppressionStore {
  add(cnpj: string, reason?: string): Promise<void>;
  contains(cnpj: string): Promise<boolean>;
  list(): Promise<{ cnpj: string; reason: string | null; createdAt: string }[]>;
}

export const SUPPRESSION_STORE = Symbol("SUPPRESSION_STORE");

@Injectable()
export class MemorySuppressionStore implements SuppressionStore {
  private readonly map = new Map<string, { reason: string | null; createdAt: string }>();
  async add(cnpj: string, reason?: string): Promise<void> {
    this.map.set(cnpj, { reason: reason ?? null, createdAt: new Date().toISOString() });
  }
  async contains(cnpj: string): Promise<boolean> {
    return this.map.has(cnpj);
  }
  async list(): Promise<{ cnpj: string; reason: string | null; createdAt: string }[]> {
    return [...this.map.entries()].map(([cnpj, v]) => ({ cnpj, ...v }));
  }
}

// ---------- Campaigns ----------
export interface CampaignRecord {
  id: string;
  name: string;
  workflow: Workflow;
  status: "draft" | "paused" | "active";
  createdAt?: string;
}

export interface CampaignStore {
  create(record: CampaignRecord): Promise<void>;
  get(id: string): Promise<CampaignRecord | null>;
  list(): Promise<CampaignRecord[]>;
  setStatus(id: string, status: CampaignRecord["status"]): Promise<void>;
}

export const CAMPAIGN_STORE = Symbol("CAMPAIGN_STORE");

@Injectable()
export class MemoryCampaignStore implements CampaignStore {
  private readonly map = new Map<string, CampaignRecord>();
  async create(record: CampaignRecord): Promise<void> {
    this.map.set(record.id, { ...record, createdAt: record.createdAt ?? new Date().toISOString() });
  }
  async get(id: string): Promise<CampaignRecord | null> {
    return this.map.get(id) ?? null;
  }
  async list(): Promise<CampaignRecord[]> {
    return [...this.map.values()];
  }
  async setStatus(id: string, status: CampaignRecord["status"]): Promise<void> {
    const rec = this.map.get(id);
    if (rec) this.map.set(id, { ...rec, status });
  }
}

// ---------- Contadores + amostra de saúde ----------
export interface HealthSample {
  delivered: number;
  sent: number;
  rejected: number;
  readRate: number;
  replyRate: number;
}

export interface CounterState {
  counters: FunnelCounters;
  health: HealthSample;
}

/** Tipos de evento do funil que incrementam contadores (opt-out é tratado à parte). */
export type CounterEventType = "sent" | "delivered" | "read" | "replied" | "qualified" | "scheduled" | "closed";

export interface CounterStore {
  get(): Promise<CounterState>;
  set(state: CounterState): Promise<void>;
  increment(type: CounterEventType): Promise<void>;
}

export const COUNTER_STORE = Symbol("COUNTER_STORE");

@Injectable()
export class MemoryCounterStore implements CounterStore {
  private state: CounterState = {
    counters: { sent: 0, delivered: 0, read: 0, replied: 0, qualified: 0, scheduled: 0, closed: 0, rejected: 0 },
    health: { delivered: 0, sent: 0, rejected: 0, readRate: 0, replyRate: 0 },
  };
  async get(): Promise<CounterState> {
    return JSON.parse(JSON.stringify(this.state));
  }
  async set(state: CounterState): Promise<void> {
    this.state = JSON.parse(JSON.stringify(state));
  }
  async increment(type: CounterEventType): Promise<void> {
    this.state.counters[type] += 1;
    if (type === "sent") this.state.health.sent += 1;
  }
}

// ---------- Eventos (ingestão ATÔMICA idempotente) ----------
export type EventType = CounterEventType | "optout";

/** Efeito derivado aplicado atomicamente junto com o registro do evento. */
export type EventEffect = "counter" | "optout";

export interface FunnelEvent {
  eventId: string;
  type: EventType;
  cnpj?: string;
  channel?: string;
}

export interface EventStore {
  /** Registra o evento e aplica o efeito derivado de forma ATÔMICA (transação no pg).
   *  - duplicate=true se eventId já processado (nenhum efeito aplicado).
   *  - Eventos fora de ordem (invariante do funil) lançam FunnelInvariantError — nunca mascarados. */
  apply(event: FunnelEvent, effect: EventEffect): Promise<{ duplicate: boolean }>;
}

export const EVENT_STORE = Symbol("EVENT_STORE");

@Injectable()
export class MemoryEventStore implements EventStore {
  private readonly seen = new Set<string>();

  /** Em memória o sink precisa alcançar os mesmos stores que Metrics/Suppression leem (consistência nos testes). */
  constructor(private readonly deps?: { counters?: CounterStore; suppression?: SuppressionStore }) {}

  async apply(event: FunnelEvent, effect: EventEffect): Promise<{ duplicate: boolean }> {
    if (this.seen.has(event.eventId)) return { duplicate: true };
    this.seen.add(event.eventId);
    try {
      if (effect === "counter") {
        const state = await this.deps?.counters?.get();
        if (state) {
          const inv = assertFunnelInvariant(state.counters, event.type as FunnelStage);
          if (!inv.ok) throw new FunnelInvariantError(inv.reason);
          await this.deps!.counters!.increment(event.type as CounterEventType);
        }
      } else if (effect === "optout") {
        await this.deps?.suppression?.add(event.cnpj ?? "", "opt_out_event");
      }
    } catch (err) {
      // evento não consumido: retry corrigido deve poder reaplicar (consistente com ROLLBACK no pg)
      this.seen.delete(event.eventId);
      throw err;
    }
    return { duplicate: false };
  }
}

// ---------- Leads (pipeline persistido) ----------
export interface LeadRecord {
  cnpj: string;
  companyName: string;
  cnae: string;
  city: string;
  state: string;
  whatsapp: string | null;
  email: string | null;
  icpFitScore: number;
  source: string;
  pipelineRunId: string | null;
  processedAt: string;
}

export interface PipelineRunRecord {
  runId: string;
  query: string | null;
  region: string | null;
  collected: number;
  deduplicated: number;
  rejected: number;
  qualified: number;
  createdAt: string;
}

export interface LeadStore {
  listLeads(limit: number, offset: number): Promise<LeadRecord[]>;
  listRuns(limit: number): Promise<PipelineRunRecord[]>;
  countLeads(): Promise<number>;
}

export const LEAD_STORE = Symbol("LEAD_STORE");

@Injectable()
export class MemoryLeadStore implements LeadStore {
  private leads: LeadRecord[] = [];
  private runs: PipelineRunRecord[] = [];

  async listLeads(limit: number, offset: number): Promise<LeadRecord[]> {
    return this.leads.slice(offset, offset + limit);
  }
  async listRuns(limit: number): Promise<PipelineRunRecord[]> {
    return this.runs.slice(0, limit);
  }
  async countLeads(): Promise<number> {
    return this.leads.length;
  }
}

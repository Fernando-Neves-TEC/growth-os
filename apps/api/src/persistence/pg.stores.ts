/** Implementações PostgreSQL (pg) dos stores de persistência (Fase 3). */
import { Inject, Injectable } from "@nestjs/common";
import {
  assertFunnelInvariant,
  FunnelInvariantError,
  type FunnelCounters,
  type FunnelStage,
  type Workflow,
} from "@growthos/core";
import { PG_POOL } from "../db/db.module.js";
import type {
  CampaignRecord,
  CampaignStore,
  CounterEventType,
  CounterState,
  CounterStore,
  EventEffect,
  EventStore,
  FunnelEvent,
  HealthSample,
  KillSwitchState,
  KillSwitchStore,
  LeadRecord,
  LeadStore,
  PipelineRunRecord,
  SuppressionStore,
} from "./stores.js";
import type { Pool } from "pg";

@Injectable()
export class PgKillSwitchStore implements KillSwitchStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async get(): Promise<KillSwitchState> {
    const { rows } = await this.pool.query<{ paused: boolean; reason: string | null }>(
      "SELECT paused, reason FROM kill_switch_state WHERE id = 1",
    );
    const r = rows[0];
    return { paused: r?.paused ?? false, reason: r?.reason ?? null };
  }

  async set(state: KillSwitchState): Promise<void> {
    await this.pool.query(
      "UPDATE kill_switch_state SET paused = $1, reason = $2, updated_at = now() WHERE id = 1",
      [state.paused, state.reason],
    );
  }
}

@Injectable()
export class PgSuppressionStore implements SuppressionStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async add(cnpj: string, reason?: string): Promise<void> {
    await this.pool.query(
      "INSERT INTO suppression (cnpj, reason) VALUES ($1, $2) ON CONFLICT (cnpj) DO NOTHING",
      [cnpj, reason ?? null],
    );
  }

  async contains(cnpj: string): Promise<boolean> {
    const { rows } = await this.pool.query("SELECT 1 FROM suppression WHERE cnpj = $1", [cnpj]);
    return rows.length > 0;
  }

  async list(): Promise<{ cnpj: string; reason: string | null; createdAt: string }[]> {
    const { rows } = await this.pool.query<{ cnpj: string; reason: string | null; created_at: string }>(
      "SELECT cnpj, reason, created_at FROM suppression ORDER BY created_at",
    );
    return rows.map((r) => ({ cnpj: r.cnpj, reason: r.reason, createdAt: r.created_at }));
  }
}

@Injectable()
export class PgCampaignStore implements CampaignStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(record: CampaignRecord): Promise<void> {
    await this.pool.query(
      "INSERT INTO campaigns (id, name, workflow, status) VALUES ($1, $2, $3, $4)",
      [record.id, record.name, JSON.stringify(record.workflow), record.status],
    );
  }

  async get(id: string): Promise<CampaignRecord | null> {
    const { rows } = await this.pool.query<{ id: string; name: string; workflow: unknown; status: string; created_at: string }>(
      "SELECT id, name, workflow, status, created_at FROM campaigns WHERE id = $1",
      [id],
    );
    const r = rows[0];
    if (!r) return null;
    return { id: r.id, name: r.name, workflow: parseJsonb(r.workflow), status: r.status as CampaignRecord["status"], createdAt: r.created_at };
  }

  async list(): Promise<CampaignRecord[]> {
    const { rows } = await this.pool.query<{ id: string; name: string; workflow: unknown; status: string; created_at: string }>(
      "SELECT id, name, workflow, status, created_at FROM campaigns ORDER BY created_at",
    );
    return rows.map((r) => ({ id: r.id, name: r.name, workflow: parseJsonb(r.workflow), status: r.status as CampaignRecord["status"], createdAt: r.created_at }));
  }

  async setStatus(id: string, status: CampaignRecord["status"]): Promise<void> {
    await this.pool.query("UPDATE campaigns SET status = $2 WHERE id = $1", [id, status]);
  }
}

@Injectable()
export class PgCounterStore implements CounterStore {
  private readonly col: Record<CounterEventType, string> = {
    sent: "sent",
    delivered: "delivered",
    read: "read",
    replied: "replied",
    qualified: "qualified",
    scheduled: "scheduled",
    closed: "closed",
  };

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async get(): Promise<CounterState> {
    const { rows } = await this.pool.query<{
      sent: number;
      delivered: number;
      read: number;
      replied: number;
      qualified: number;
      scheduled: number;
      closed: number;
      rejected: number;
      read_rate: number;
      reply_rate: number;
    }>("SELECT sent, delivered, read, replied, qualified, scheduled, closed, rejected, read_rate, reply_rate FROM funnel_counters WHERE id = 1");
    const r = rows[0];
    const counters: FunnelCounters = {
      sent: r?.sent ?? 0,
      delivered: r?.delivered ?? 0,
      read: r?.read ?? 0,
      replied: r?.replied ?? 0,
      qualified: r?.qualified ?? 0,
      scheduled: r?.scheduled ?? 0,
      closed: r?.closed ?? 0,
      rejected: r?.rejected ?? 0,
    };
    const health: HealthSample = {
      delivered: counters.delivered,
      sent: counters.sent,
      rejected: counters.rejected,
      // Taxas derivadas dos contadores (fonte única de verdade)
      readRate: counters.delivered > 0 ? (counters.read / counters.delivered) * 100 : 0,
      replyRate: counters.read > 0 ? (counters.replied / counters.read) * 100 : 0,
    };
    return { counters, health };
  }

  async set(state: CounterState): Promise<void> {
    const c = state.counters;
    const h = state.health;
    await this.pool.query(
      `UPDATE funnel_counters SET
         sent=$1, delivered=$2, read=$3, replied=$4, qualified=$5, scheduled=$6, closed=$7, rejected=$8,
         read_rate=$9, reply_rate=$10, updated_at=now()
       WHERE id = 1`,
      [c.sent, c.delivered, c.read, c.replied, c.qualified, c.scheduled, c.closed, c.rejected, h.readRate, h.replyRate],
    );
  }

  async increment(type: CounterEventType): Promise<void> {
    const col = this.col[type];
    await this.pool.query(`UPDATE funnel_counters SET ${col} = ${col} + 1, updated_at = now() WHERE id = 1`);
  }
}

/** pg devolve colunas jsonb como objetos JS; defende também contra string (portabilidade). */
function parseJsonb(v: unknown): Workflow {
  return typeof v === "string" ? (JSON.parse(v) as Workflow) : (v as Workflow);
}

/** Coluna de contador por tipo de evento do funil (tabela funnel_counters). */
export const COUNTER_COLUMNS: Record<CounterEventType, string> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  replied: "replied",
  qualified: "qualified",
  scheduled: "scheduled",
  closed: "closed",
};

@Injectable()
export class PgEventStore implements EventStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Atômico (H1): evento + efeito derivado (contador/optout) na MESMA transação.
   *  Invariante do funil validado com a linha de contadores travada (FOR UPDATE) —
   *  nunca há estado "evento persistido + contador ausente" e retry não duplica efeito. */
  async apply(event: FunnelEvent, effect: EventEffect): Promise<{ duplicate: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rowCount } = await client.query(
        "INSERT INTO events (event_id, type, cnpj, channel) VALUES ($1, $2, $3, $4) ON CONFLICT (event_id) DO NOTHING",
        [event.eventId, event.type, event.cnpj ?? null, event.channel ?? null],
      );
      const inserted = (rowCount ?? 0) > 0;
      if (inserted) {
        if (effect === "counter") {
          const { rows } = await client.query<{
            sent: number; delivered: number; read: number; replied: number;
            qualified: number; scheduled: number; closed: number; rejected: number;
          }>(
            "SELECT sent, delivered, read, replied, qualified, scheduled, closed, rejected FROM funnel_counters WHERE id = 1 FOR UPDATE",
          );
          const counters = rows[0] ?? {
            sent: 0, delivered: 0, read: 0, replied: 0, qualified: 0, scheduled: 0, closed: 0, rejected: 0,
          };
          const inv = assertFunnelInvariant(counters, event.type as FunnelStage);
          if (!inv.ok) {
            await client.query("ROLLBACK");
            throw new FunnelInvariantError(inv.reason);
          }
          const col = COUNTER_COLUMNS[event.type as CounterEventType];
          await client.query(`UPDATE funnel_counters SET ${col} = ${col} + 1, updated_at = now() WHERE id = 1`);
        } else if (effect === "optout") {
          await client.query(
            "INSERT INTO suppression (cnpj, reason) VALUES ($1, 'opt_out_event') ON CONFLICT (cnpj) DO NOTHING",
            [event.cnpj ?? null],
          );
        }
      }
      await client.query("COMMIT");
      return { duplicate: !inserted };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}

@Injectable()
export class PgLeadStore implements LeadStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listLeads(limit: number, offset: number): Promise<LeadRecord[]> {
    const { rows } = await this.pool.query<{
      cnpj: string;
      company_name: string;
      cnae: string;
      city: string;
      state: string;
      whatsapp: string | null;
      email: string | null;
      icp_fit_score: string;
      source: string;
      pipeline_run_id: string | null;
      processed_at: string;
    }>(
      `SELECT cnpj, company_name, cnae, city, state, whatsapp, email, icp_fit_score, source, pipeline_run_id, processed_at
       FROM leads_enriched ORDER BY icp_fit_score DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows.map((r) => ({
      cnpj: r.cnpj,
      companyName: r.company_name,
      cnae: r.cnae,
      city: r.city,
      state: r.state,
      whatsapp: r.whatsapp,
      email: r.email,
      icpFitScore: Number(r.icp_fit_score),
      source: r.source,
      pipelineRunId: r.pipeline_run_id,
      processedAt: r.processed_at,
    }));
  }

  async listRuns(limit: number): Promise<PipelineRunRecord[]> {
    const { rows } = await this.pool.query<{
      run_id: string;
      query: string | null;
      region: string | null;
      collected: number;
      deduplicated: number;
      rejected: number;
      qualified: number;
      created_at: string;
    }>(
      `SELECT run_id, query, region, collected, deduplicated, rejected, qualified, created_at
       FROM pipeline_runs ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      runId: r.run_id,
      query: r.query,
      region: r.region,
      collected: r.collected,
      deduplicated: r.deduplicated,
      rejected: r.rejected,
      qualified: r.qualified,
      createdAt: r.created_at,
    }));
  }

  async countLeads(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>("SELECT count(*)::text AS count FROM leads_enriched");
    return Number(rows[0]?.count ?? 0);
  }
}

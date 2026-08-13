/** Implementações PostgreSQL (pg) dos stores de identidade/sessão/auditoria (S2 + S10). */
import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.module.js";
import type {
  OperatorRecord,
  OperatorsStore,
  SecurityAuditEvent,
  SecurityAuditStore,
  SessionRecord,
  SessionStore,
} from "./stores.js";

@Injectable()
export class PgOperatorsStore implements OperatorsStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(rec: OperatorRecord): Promise<void> {
    await this.pool.query(
      "INSERT INTO operators (id, email, password_hash, role, active) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (lower(email)) DO NOTHING",
      [rec.id, rec.email, rec.passwordHash, rec.role, rec.active],
    );
  }

  async findByEmail(email: string): Promise<OperatorRecord | null> {
    const { rows } = await this.pool.query<{
      id: string; email: string; password_hash: string; role: string; active: boolean; created_at: string; updated_at: string;
    }>("SELECT id, email, password_hash, role, active, created_at, updated_at FROM operators WHERE lower(email) = lower($1)", [email]);
    const r = rows[0];
    if (!r) return null;
    return { id: r.id, email: r.email, passwordHash: r.password_hash, role: r.role, active: r.active, createdAt: r.created_at, updatedAt: r.updated_at };
  }

  async getById(id: string): Promise<OperatorRecord | null> {
    const { rows } = await this.pool.query<{
      id: string; email: string; password_hash: string; role: string; active: boolean; created_at: string; updated_at: string;
    }>("SELECT id, email, password_hash, role, active, created_at, updated_at FROM operators WHERE id = $1", [id]);
    const r = rows[0];
    if (!r) return null;
    return { id: r.id, email: r.email, passwordHash: r.password_hash, role: r.role, active: r.active, createdAt: r.created_at, updatedAt: r.updated_at };
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.pool.query("UPDATE operators SET active = $2, updated_at = now() WHERE id = $1", [id, active]);
  }
}

@Injectable()
export class PgSessionStore implements SessionStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(rec: SessionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions (id, operator_id, token_hash, csrf_token, expires_at, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [rec.id, rec.operatorId, rec.tokenHash, rec.csrfToken, rec.expiresAt, rec.ip, rec.userAgent],
    );
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const { rows } = await this.pool.query<{
      id: string; operator_id: string; token_hash: string; csrf_token: string; expires_at: string;
      ip: string | null; user_agent: string | null; created_at: string; last_seen_at: string; revoked_at: string | null;
    }>("SELECT id, operator_id, token_hash, csrf_token, expires_at, ip, user_agent, created_at, last_seen_at, revoked_at FROM sessions WHERE token_hash = $1", [tokenHash]);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id, operatorId: r.operator_id, tokenHash: r.token_hash, csrfToken: r.csrf_token,
      expiresAt: r.expires_at, ip: r.ip, userAgent: r.user_agent, createdAt: r.created_at,
      lastSeenAt: r.last_seen_at, revokedAt: r.revoked_at,
    };
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query("UPDATE sessions SET revoked_at = now() WHERE token_hash = $1", [tokenHash]);
  }

  async deleteExpired(): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE expires_at < now() OR revoked_at IS NOT NULL");
  }
}

@Injectable()
export class PgSecurityAuditStore implements SecurityAuditStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async append(ev: SecurityAuditEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO security_audit_events (event, request_id, actor_operator_id, ip, path, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [ev.event, ev.requestId, ev.actorOperatorId, ev.ip, ev.path, ev.userAgent, JSON.stringify(ev.metadata)],
    );
  }

  async list(limit: number): Promise<SecurityAuditEvent[]> {
    const { rows } = await this.pool.query<{
      id: string; occurred_at: string; event: string; request_id: string | null;
      actor_operator_id: string | null; ip: string | null; path: string | null; user_agent: string | null; metadata: Record<string, unknown>;
    }>("SELECT id, occurred_at, event, request_id, actor_operator_id, ip, path, user_agent, metadata FROM security_audit_events ORDER BY occurred_at DESC LIMIT $1", [limit]);
    return rows.map((r) => ({
      id: r.id, occurredAt: r.occurred_at, event: r.event, requestId: r.request_id,
      actorOperatorId: r.actor_operator_id, ip: r.ip, path: r.path, userAgent: r.user_agent, metadata: r.metadata,
    }));
  }
}

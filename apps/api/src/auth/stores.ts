/** Contratos de persistência de identidade/sessão/auditoria (S2 + S10) + impls em memória p/ testes. */

// ---------- Operadores ----------
export interface OperatorRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorsStore {
  create(rec: OperatorRecord): Promise<void>;
  findByEmail(email: string): Promise<OperatorRecord | null>;
  getById(id: string): Promise<OperatorRecord | null>;
  setActive(id: string, active: boolean): Promise<void>;
}

export const OPERATORS_STORE = Symbol("OPERATORS_STORE");

export class MemoryOperatorsStore implements OperatorsStore {
  private readonly rows = new Map<string, OperatorRecord>();
  async create(rec: OperatorRecord): Promise<void> {
    this.rows.set(rec.id, { ...rec });
  }
  async findByEmail(email: string): Promise<OperatorRecord | null> {
    const e = email.trim().toLowerCase();
    for (const r of this.rows.values()) {
      if (r.email.toLowerCase() === e) return { ...r };
    }
    return null;
  }
  async getById(id: string): Promise<OperatorRecord | null> {
    const r = this.rows.get(id);
    return r ? { ...r } : null;
  }
  async setActive(id: string, active: boolean): Promise<void> {
    const r = this.rows.get(id);
    if (r) this.rows.set(id, { ...r, active, updatedAt: new Date().toISOString() });
  }
}

// ---------- Sessões ----------
export interface SessionRecord {
  id: string;
  operatorId: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
}

export interface SessionStore {
  create(rec: SessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeByTokenHash(tokenHash: string): Promise<void>;
  /** SECURITY CLOSURE (baixo B): atualiza lastSeenAt (amortizado — o impl pg só grava se >1min). */
  touch(id: string): Promise<void>;
  /** SECURITY CLOSURE: revoga TODAS as sessões ativas de um operador (ex.: troca de senha/vazamento). */
  revokeAllSessions(operatorId: string): Promise<void>;
  deleteExpired(): Promise<void>;
}

export const SESSION_STORE = Symbol("SESSION_STORE");

export class MemorySessionStore implements SessionStore {
  private readonly rows = new Map<string, SessionRecord>();
  async create(rec: SessionRecord): Promise<void> {
    this.rows.set(rec.tokenHash, { ...rec });
  }
  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const r = this.rows.get(tokenHash);
    return r ? { ...r } : null;
  }
  async revokeByTokenHash(tokenHash: string): Promise<void> {
    const r = this.rows.get(tokenHash);
    if (r) this.rows.set(tokenHash, { ...r, revokedAt: new Date().toISOString() });
  }
  async touch(id: string): Promise<void> {
    for (const [k, r] of this.rows) {
      if (r.id === id) this.rows.set(k, { ...r, lastSeenAt: new Date().toISOString() });
    }
  }
  async revokeAllSessions(operatorId: string): Promise<void> {
    for (const [k, r] of this.rows) {
      if (r.operatorId === operatorId && !r.revokedAt) this.rows.set(k, { ...r, revokedAt: new Date().toISOString() });
    }
  }
  async deleteExpired(): Promise<void> {
    const now = Date.now();
    for (const [k, r] of this.rows) {
      if (new Date(r.expiresAt).getTime() < now || r.revokedAt) this.rows.delete(k);
    }
  }
}

// ---------- Auditoria de segurança (S10) ----------
export interface SecurityAuditEvent {
  id?: string;
  occurredAt: string;
  event: string;
  requestId: string | null;
  actorOperatorId: string | null;
  ip: string | null;
  path: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}

export interface SecurityAuditStore {
  append(ev: SecurityAuditEvent): Promise<void>;
  list(limit: number): Promise<SecurityAuditEvent[]>;
}

export const SECURITY_AUDIT_STORE = Symbol("SECURITY_AUDIT_STORE");

export class MemorySecurityAuditStore implements SecurityAuditStore {
  private readonly rows: SecurityAuditEvent[] = [];
  async append(ev: SecurityAuditEvent): Promise<void> {
    this.rows.push({ ...ev, metadata: { ...ev.metadata } });
  }
  async list(limit: number): Promise<SecurityAuditEvent[]> {
    return this.rows.slice(-limit).reverse();
  }
}

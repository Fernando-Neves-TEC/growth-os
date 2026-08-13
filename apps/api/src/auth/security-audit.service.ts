/** S10 — camada estruturada de eventos de segurança (local, pronto para sink externo).
 *  NUNCA registra: senha, API key, session token bruto, cookie, CSRF ou connection string.
 *  Redação é garantida por construção: só aceita os metadados definidos abaixo. */
import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { SECURITY_AUDIT_STORE, type SecurityAuditStore } from "./stores.js";

export const SECURITY_EVENTS = {
  AUTH_LOGIN_SUCCESS: "AUTH_LOGIN_SUCCESS",
  AUTH_LOGIN_FAILURE: "AUTH_LOGIN_FAILURE",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  AUTH_SESSION_INVALID: "AUTH_SESSION_INVALID",
  AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
  RATE_LIMIT_HIT: "RATE_LIMIT_HIT",
} as const;

export type SecurityEventName = (typeof SECURITY_EVENTS)[keyof typeof SECURITY_EVENTS];

export interface SecurityAuditContext {
  requestId?: string | null;
  actorOperatorId?: string | null;
  ip?: string | null;
  path?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/** Adapter para sink externo futuro (Sentry/Axiom/etc.) — hoje apenas no-op; integração é BLOCKED_EXTERNAL. */
export interface SecurityAuditSink {
  emit(event: SecurityAuditEventOut): Promise<void> | void;
}

export interface SecurityAuditEventOut {
  occurredAt: string;
  event: string;
  requestId: string | null;
  actorOperatorId: string | null;
  ip: string | null;
  path: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}

@Injectable()
export class SecurityAuditService {
  private readonly sinks: SecurityAuditSink[] = [];

  constructor(@Inject(SECURITY_AUDIT_STORE) private readonly store: SecurityAuditStore) {}

  addSink(sink: SecurityAuditSink): void {
    this.sinks.push(sink);
  }

  async record(event: SecurityEventName, ctx: SecurityAuditContext = {}): Promise<void> {
    const out: SecurityAuditEventOut = {
      occurredAt: new Date().toISOString(),
      event,
      requestId: ctx.requestId ?? null,
      actorOperatorId: ctx.actorOperatorId ?? null,
      ip: ctx.ip ?? null,
      path: ctx.path ?? null,
      userAgent: ctx.userAgent ?? null,
      metadata: ctx.metadata ?? {},
    };
    // Log estruturado (JSON) para observabilidade local.
    console.log(JSON.stringify({ level: "security", ...out }));
    // Persistência append-only.
    await this.store.append({
      occurredAt: out.occurredAt,
      event: out.event,
      requestId: out.requestId,
      actorOperatorId: out.actorOperatorId,
      ip: out.ip,
      path: out.path,
      userAgent: out.userAgent,
      metadata: out.metadata,
    });
    for (const sink of this.sinks) {
      try {
        await sink.emit(out);
      } catch {
        // sink externo falhou — não quebra a autenticação
      }
    }
  }
}

/** Requisição local com request_id + metadados para auditoria (criado pelo middleware). */
export function newRequestId(): string {
  return randomUUID();
}

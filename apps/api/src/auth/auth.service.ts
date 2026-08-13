/** Autenticação humana (S2): login, sessão servidor-side, logout e resolução de sessão.
 *  Domínio separado da credencial M2M (X-Api-Key) — nunca misturar. */
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "./password.js";
import { SecurityAuditService } from "./security-audit.service.js";
import { OPERATORS_STORE, SESSION_STORE, type OperatorsStore, type SessionStore } from "./stores.js";

/** esbuild/vitest não emite design:paramtypes — injeção por tipo exige @Inject explícito. */
const AUDIT_SVC = SecurityAuditService;

const SESSION_COOKIE = "growthos_session";
const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;

export interface PublicOperator {
  id: string;
  email: string;
  role: string;
}

export interface AuthSession {
  sessionToken: string;
  csrfToken: string;
  expiresAt: string;
  operator: PublicOperator;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export { SESSION_COOKIE };

/** F-01 — equalização de timing no login: hash Argon2id dummy mantido SÓ em memória (senha aleatória
 *  gerada na primeira necessidade; nunca persistida nem logada). Usa a MESMA lib/parâmetros reais. */
let dummyHash: string | undefined;
async function timingEqualizedVerify(password: string): Promise<boolean> {
  if (!dummyHash) dummyHash = await hashPassword(randomBytes(24).toString("base64url"));
  return verifyPassword(dummyHash, password);
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(OPERATORS_STORE) private readonly operators: OperatorsStore,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(AUDIT_SVC) private readonly audit: SecurityAuditService,
  ) {}

  private ttlMs(): number {
    const n = Number(process.env.GROWTHOS_SESSION_TTL_MS);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS;
  }

  async login(
    input: { email: string; password: string },
    ctx: { requestId?: string | null; ip?: string | null; path?: string | null; userAgent?: string | null },
  ): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const operator = await this.operators.findByEmail(email);
    // Mensagem genérica para não permitir enumeração de usuário.
    // F-01 (HARDENING): equalização de timing — usuário inexistente também executa um verify
    // Argon2id (hash dummy em memória) para aproximar o custo de "senha errada" em usuário existente.
    // Não é constant-time rigoroso; é equalização de timing. Não enfraquece o rate limit de login.
    const ok = operator
      ? await verifyPassword(operator.passwordHash, input.password)
      : await timingEqualizedVerify(input.password);
    if (!operator || !ok) {
      await this.audit.record("AUTH_LOGIN_FAILURE", {
        ...ctx,
        metadata: { reason: operator ? "senha_incorreta" : "usuario_inexistente", email },
      });
      throw new UnauthorizedException("credenciais inválidas");
    }
    if (!operator.active) {
      await this.audit.record("AUTH_LOGIN_FAILURE", {
        ...ctx,
        actorOperatorId: operator.id,
        metadata: { reason: "operador_inativo", email },
      });
      throw new UnauthorizedException("credenciais inválidas");
    }

    await this.sessions.deleteExpired();
    const sessionToken = randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + this.ttlMs()).toISOString();
    await this.sessions.create({
      id: randomUUID(),
      operatorId: operator.id,
      tokenHash: hashToken(sessionToken),
      csrfToken,
      expiresAt,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      revokedAt: null,
    });
    await this.audit.record("AUTH_LOGIN_SUCCESS", {
      ...ctx,
      actorOperatorId: operator.id,
      metadata: { email },
    });
    return {
      sessionToken,
      csrfToken,
      expiresAt,
      operator: { id: operator.id, email: operator.email, role: operator.role },
    };
  }

  /** Resolve a sessão a partir do token do cookie; retorna null se ausente/inválida/expirada/revogada. */
  async resolveSession(token: string | undefined | null, ctx: { requestId?: string | null; ip?: string | null; path?: string | null; userAgent?: string | null }):
    Promise<{ sessionToken: string; csrfToken: string; expiresAt: string; operator: PublicOperator } | null> {
    if (!token) return null;
    const session = await this.sessions.findByTokenHash(hashToken(token));
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() < Date.now()) {
      await this.audit.record("AUTH_SESSION_INVALID", {
        ...ctx,
        actorOperatorId: session?.operatorId ?? null,
        metadata: {
          reason: session ? (session.revokedAt ? "revogada" : "expirada") : "desconhecida",
        },
      });
      await this.sessions.deleteExpired();
      return null;
    }
    const operator = await this.operators.getById(session.operatorId);
    if (!operator || !operator.active) {
      await this.audit.record("AUTH_SESSION_INVALID", {
        ...ctx,
        actorOperatorId: session.operatorId,
        metadata: { reason: operator ? "operador_inativo" : "operador_removido" },
      });
      await this.sessions.revokeByTokenHash(session.tokenHash);
      return null;
    }
    // SECURITY CLOSURE (baixo B): atualiza lastSeenAt (amortizado pelo impl pg — só grava se >1min).
    await this.sessions.touch(session.id);
    return {
      sessionToken: token,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
      operator: { id: operator.id, email: operator.email, role: operator.role },
    };
  }

  async logout(token: string | undefined | null, ctx: { requestId?: string | null; ip?: string | null; path?: string | null; userAgent?: string | null; actorOperatorId?: string }): Promise<void> {
    if (token) {
      const session = await this.sessions.findByTokenHash(hashToken(token));
      await this.sessions.revokeByTokenHash(hashToken(token));
      if (session) {
        await this.audit.record("AUTH_LOGOUT", {
          ...ctx,
          actorOperatorId: ctx.actorOperatorId ?? session.operatorId,
        });
        return;
      }
    }
    await this.audit.record("AUTH_LOGOUT", { ...ctx, metadata: { reason: "sem_sessao" } });
  }

  /** SECURITY CLOSURE: revoga TODAS as sessões ativas de um operador (ex.: troca de senha/vazamento).
   *  Auditoria registra AUTH_LOGOUT com reason=revoke_all. NÃO há endpoint HTTP (apenas CLI local). */
  async revokeAllSessions(
    email: string,
    ctx: { requestId?: string | null; ip?: string | null; path?: string | null; userAgent?: string | null } = {},
  ): Promise<void> {
    const operator = await this.operators.findByEmail(email.trim().toLowerCase());
    if (!operator) return;
    await this.sessions.revokeAllSessions(operator.id);
    await this.audit.record("AUTH_LOGOUT", {
      ...ctx,
      actorOperatorId: operator.id,
      metadata: { reason: "revoke_all", email: operator.email },
    });
  }

  async createOperator(email: string, password: string, role = "admin"): Promise<{ id: string; email: string; role: string }> {
    // F-10 (HARDENING): nesta fase existe SOMENTE o papel 'admin' (sem RBAC). Rejeita qualquer outro
    // papel para não gravar estado ambíguo (a migration 014 também impõe CHECK (role = 'admin')).
    if (role !== "admin") throw new Error(`papel não suportado: ${role} (somente 'admin' nesta fase)`);
    const passwordHash = await hashPassword(password);
    const id = randomUUID();
    await this.operators.create({
      id,
      email: email.trim().toLowerCase(),
      passwordHash,
      role,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { id, email: email.trim().toLowerCase(), role };
  }
}

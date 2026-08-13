/** Guard global de autenticação/autorização (S2): separa sessão humana de credencial M2M.
 *  - valida sessão (cookie HttpOnly) e, em mutações, exige CSRF (token por sessão);
 *  - valida X-Api-Key para rotas m2m/shared;
 *  - padrão sem decorator = human (fail-closed);
 *  - registra eventos de segurança (AUTH_SESSION_INVALID / AUTHORIZATION_DENIED). */
import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AuthService, SESSION_COOKIE } from "./auth.service.js";
import { AUTH_METADATA, type AuthType } from "./auth.decorators.js";
import { SecurityAuditService } from "./security-audit.service.js";
import { ApiKeyGuard } from "../security/api-key.guard.js";

/** esbuild/vitest não emite design:paramtypes — injeção por tipo exige @Inject explícito. */
const AUTH_SVC = AuthService;
const AUDIT_SVC = SecurityAuditService;
const API_KEY_GUARD = ApiKeyGuard;

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface AuthedRequest {
  method?: string;
  url?: string;
  originalUrl?: string;
  ip?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
  operator?: { id: string; email: string; role: string };
  sessionToken?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_SVC) private readonly auth: AuthService,
    @Inject(AUDIT_SVC) private readonly audit: SecurityAuditService,
    @Inject(API_KEY_GUARD) private readonly apiKey: ApiKeyGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const type = (Reflect.getMetadata(AUTH_METADATA, context.getHandler()) as AuthType | undefined) ?? "human";
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const path = req.originalUrl ?? req.url ?? "";
    const ctx = {
      requestId: randomUUID(),
      ip: req.ip ?? null,
      path,
      userAgent: (req.headers?.["user-agent"] as string | undefined) ?? null,
    };

    if (type === "public") return true;

    const cookie = req.cookies?.[SESSION_COOKIE];
    if (cookie) {
      const session = await this.auth.resolveSession(cookie, ctx);
      if (session) {
        const method = (req.method ?? "GET").toUpperCase();
        if (MUTATIONS.has(method)) {
          const csrf = req.headers?.["x-csrf-token"];
          if (typeof csrf !== "string" || csrf !== session.csrfToken) {
            await this.audit.record("AUTHORIZATION_DENIED", {
              ...ctx,
              actorOperatorId: session.operator.id,
              metadata: { reason: "csrf_invalido", type },
            });
            throw new ForbiddenException("csrf inválido");
          }
        }
        if (type === "human" || type === "shared") {
          req.operator = session.operator;
          req.sessionToken = session.sessionToken;
          return true;
        }
        // tipo m2m exige credencial de máquina, não sessão humana
      }
    }

    if (type === "m2m" || type === "shared") {
      if (this.apiKey.validate(req as AuthedRequest)) return true;
    }

    await this.audit.record("AUTHORIZATION_DENIED", {
      ...ctx,
      metadata: { reason: "sem_autenticacao_adequada", type },
    });
    throw new UnauthorizedException("não autenticado");
  }
}

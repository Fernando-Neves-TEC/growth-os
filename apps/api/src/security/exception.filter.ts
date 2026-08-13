import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Inject, Optional } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { FunnelInvariantError } from "@growthos/core";
import type { Request, Response } from "express";
import { SecurityAuditService } from "../auth/security-audit.service.js";

/** esbuild/vitest não emite design:paramtypes — injeção por tipo exige @Inject explícito. */
const AUDIT_SVC = SecurityAuditService;

/** Erros estruturados e consistentes para a API (observabilidade).
 *  Loga o erro original no servidor (nunca expõe stack ao cliente).
 *  S10: registra RATE_LIMIT_HIT quando o rate limit é excedido (429). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Optional() @Inject(AUDIT_SVC) private readonly audit?: SecurityAuditService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    console.error("[growthos-api] erro:", exception instanceof Error ? exception.stack ?? exception.message : exception);
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const asHttp = exception as { status?: number; statusCode?: number };
    const is413 = typeof asHttp?.status === "number" && asHttp.status === 413;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : is413
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : exception instanceof FunnelInvariantError
            ? HttpStatus.UNPROCESSABLE_ENTITY
            : HttpStatus.INTERNAL_SERVER_ERROR;
    // F-11 (HARDENING): 429 não expõe a classe interna do throttler (ThrottlerException).
    const is429 = status === HttpStatus.TOO_MANY_REQUESTS;
    const body = exception instanceof HttpException
      ? is429
        ? { message: "muitas requisições" }
        : exception.getResponse()
      : is413
        ? { message: "payload muito grande" }
        : exception instanceof FunnelInvariantError
          ? { message: exception.message, code: exception.code }
          : { message: "erro interno" };
    const payload = typeof body === "object" && body !== null ? (body as object) : { message: body };

    // S10 — rate limit atingido vira evento de segurança estruturado (sem segredos).
    if (status === HttpStatus.TOO_MANY_REQUESTS && this.audit) {
      void this.audit.record("RATE_LIMIT_HIT", {
        requestId: randomUUID(),
        ip: req.ip ?? null,
        path: req.originalUrl ?? req.url ?? "",
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      });
    }

    res.status(status).json({ statusCode: status, ...payload, path: req.url });
  }
}

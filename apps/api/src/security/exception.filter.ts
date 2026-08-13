import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { FunnelInvariantError } from "@growthos/core";
import type { Request, Response } from "express";

/** Erros estruturados e consistentes para a API (observabilidade).
 *  Loga o erro original no servidor (nunca expõe stack ao cliente). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
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
    const body = exception instanceof HttpException
      ? exception.getResponse()
      : is413
        ? { message: "payload muito grande" }
        : exception instanceof FunnelInvariantError
          ? { message: exception.message, code: exception.code }
          : { message: "erro interno" };
    const payload = typeof body === "object" && body !== null ? (body as object) : { message: body };
    res.status(status).json({ statusCode: status, ...payload, path: req.url });
  }
}

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { FunnelInvariantError } from "@growthos/core";
import type { Request, Response } from "express";

/** Erros estruturados e consistentes para a API (observabilidade). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : exception instanceof FunnelInvariantError
          ? HttpStatus.UNPROCESSABLE_ENTITY
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException
      ? exception.getResponse()
      : exception instanceof FunnelInvariantError
        ? { message: exception.message, code: exception.code }
        : { message: "erro interno" };
    const payload = typeof body === "object" && body !== null ? (body as object) : { message: body };
    res.status(status).json({ statusCode: status, ...payload, path: req.url });
  }
}

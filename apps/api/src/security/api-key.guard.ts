import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

/**
 * Autenticação mínima config-driven:
 * - Se GROWTHOS_API_KEY estiver definida, exige header `x-api-key` igual.
 * - Se vazia/ausente, desativada (dev local / simulação).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const key = process.env.GROWTHOS_API_KEY;
    if (!key) return true; // auth desativada
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.header("x-api-key");
    if (!provided || provided !== key) {
      throw new UnauthorizedException("api key inválida");
    }
    return true;
  }
}

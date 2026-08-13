import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

/**
 * Autenticação config-driven com contrato de modos (C2):
 * - `approved` (produção): SEMPRE exige `x-api-key` válida (fail-closed).
 * - `simulation`/`design` (local): se GROWTHOS_API_KEY estiver definida, exige; senão aberto (dev local).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const mode = process.env.GROWTHOS_MODE ?? "simulation";
    const key = process.env.GROWTHOS_API_KEY?.trim() ?? "";
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.header("x-api-key");

    if (mode === "approved") {
      if (!key || !provided || provided !== key) {
        throw new UnauthorizedException("api key inválida");
      }
      return true;
    }

    if (!key) return true; // auth desativada (dev local / simulação)
    if (!provided || provided !== key) {
      throw new UnauthorizedException("api key inválida");
    }
    return true;
  }
}

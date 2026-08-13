import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

/**
 * Credencial MÁQUINA-A-MÁQUINA (M2M), com contrato de modos (C2):
 * - `approved` (produção): SEMPRE exige `x-api-key` válida (fail-closed).
 * - `simulation`/`design` (local): se GROWTHOS_API_KEY estiver definida, exige; senão aberto (dev local).
 * NUNCA é a autenticação de operador humano — isso é a sessão (AuthGuard).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!this.validate(req)) {
      throw new UnauthorizedException("api key inválida");
    }
    return true;
  }

  validate(req: { headers?: Record<string, unknown> }): boolean {
    const mode = process.env.GROWTHOS_MODE ?? "simulation";
    const key = process.env.GROWTHOS_API_KEY?.trim() ?? "";
    const provided = req.headers?.["x-api-key"] as string | undefined;

    if (mode === "approved") {
      return !!key && !!provided && provided === key;
    }
    if (!key) return true; // auth desativada (dev local / simulação)
    return !!provided && provided === key;
  }
}

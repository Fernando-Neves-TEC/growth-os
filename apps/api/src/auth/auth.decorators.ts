/** Matriz de autenticação por rota (S2).
 *  - public: sem autenticação (login/me/health).
 *  - human: sessão de operador (HUMAN_ADMIN).
 *  - m2m: credencial de máquina X-Api-Key.
 *  - shared: sessão OU credencial M2M.
 *  Padrão (sem decorator) = human — fail-closed. */
import { SetMetadata } from "@nestjs/common";

export type AuthType = "public" | "human" | "m2m" | "shared";

export const AUTH_METADATA = "auth:type";

export const Public = () => SetMetadata(AUTH_METADATA, "public");
export const Human = () => SetMetadata(AUTH_METADATA, "human");
export const M2M = () => SetMetadata(AUTH_METADATA, "m2m");
export const Shared = () => SetMetadata(AUTH_METADATA, "shared");

/** Módulo de autenticação humana (S2) + auditoria de segurança (S10). */
import { Module } from "@nestjs/common";
import { ApiKeyGuard } from "../security/api-key.guard.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { PgOperatorsStore, PgSecurityAuditStore, PgSessionStore } from "./pg.stores.js";
import { SecurityAuditController } from "./security-audit.controller.js";
import { SecurityAuditService } from "./security-audit.service.js";
import { OPERATORS_STORE, SECURITY_AUDIT_STORE, SESSION_STORE } from "./stores.js";

@Module({
  controllers: [AuthController, SecurityAuditController],
  providers: [
    AuthService,
    SecurityAuditService,
    ApiKeyGuard,
    { provide: OPERATORS_STORE, useClass: PgOperatorsStore },
    { provide: SESSION_STORE, useClass: PgSessionStore },
    { provide: SECURITY_AUDIT_STORE, useClass: PgSecurityAuditStore },
  ],
  exports: [AuthService, SecurityAuditService, ApiKeyGuard, OPERATORS_STORE, SESSION_STORE, SECURITY_AUDIT_STORE],
})
export class AuthModule {}

/** S10 — consulta de eventos de auditoria de segurança (somente operador humano autenticado). */
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { z } from "zod";
import { Human } from "./auth.decorators.js";
import { SECURITY_AUDIT_STORE, type SecurityAuditStore } from "./stores.js";
import { zodQuery } from "../validation/zod.pipe.js";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

@Controller("security")
export class SecurityAuditController {
  constructor(@Inject(SECURITY_AUDIT_STORE) private readonly store: SecurityAuditStore) {}

  @Human()
  @Get("audit")
  async list(@Query(zodQuery(QuerySchema)) q: z.infer<typeof QuerySchema>) {
    return this.store.list(q.limit ?? 100);
  }
}

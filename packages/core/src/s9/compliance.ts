/** Gates de conformidade (S9) — LGPD, anti-spam e lista de supressão (fail-closed). */

export interface ComplianceContext {
  cnpj: string;
  sentToday: number;
  dailyCeiling: number;
}

export type ComplianceVerdict = { allowed: boolean; reason?: string };

/** Lista de supressão (opt-out / LGPD). Processar opt-out é prioridade máxima. */
export class SuppressionList {
  private readonly suppressed = new Set<string>();

  add(cnpj: string): void {
    this.suppressed.add(cnpj);
  }

  contains(cnpj: string): boolean {
    return this.suppressed.has(cnpj);
  }

  get size(): number {
    return this.suppressed.size;
  }
}

/** Verifica se o lead pode ser contatado hoje (opt-out + limite diário). */
export function assertCanContact(ctx: ComplianceContext, suppression: SuppressionList): ComplianceVerdict {
  if (suppression.contains(ctx.cnpj)) {
    return { allowed: false, reason: "opt_out" };
  }
  if (ctx.sentToday >= ctx.dailyCeiling) {
    return { allowed: false, reason: "limite_diario_atingido" };
  }
  return { allowed: true };
}

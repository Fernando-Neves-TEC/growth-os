/** Gates de conformidade (S9) — LGPD, anti-spam e lista de supressão (fail-closed). */

/** Valida CNPJ (14 dígitos, dígitos verificadores módulo 11). Aceita somente dígitos. */
export function isValidCnpj(value: string): boolean {
  const c = value.replace(/\D/g, "");
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false; // todos iguais
  const calc = (len: number): number => {
    let sum = 0;
    let pos = len - 7;
    for (let i = 0; i < len; i++) {
      sum += Number(c[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

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

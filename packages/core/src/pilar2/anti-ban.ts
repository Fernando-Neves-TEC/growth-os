/** Políticas anti-ban (S4) — warm-up, jitter, janela comercial, limites por canal. */

export interface AntiBanPolicy {
  warmupDay1: number;
  warmupStep: number;
  warmupCeiling: number;
  businessHoursStart: number; // hora local (0-23)
  businessHoursEnd: number; // hora local (1-24)
  jitterMinMs: number;
  jitterMaxMs: number;
}

/** Limite diário de volume por canal no dia `dayIndex` (0 = primeiro dia). */
export function warmupLimit(policy: AntiBanPolicy, dayIndex: number): number {
  const raw = policy.warmupDay1 + dayIndex * policy.warmupStep;
  return Math.min(Math.max(raw, 0), policy.warmupCeiling);
}

/** Atraso com jitter dentro da janela [min, max]. */
export function jitterDelayMs(policy: AntiBanPolicy, rng: () => number = Math.random): number {
  const span = policy.jitterMaxMs - policy.jitterMinMs;
  return Math.round(policy.jitterMinMs + rng() * Math.max(span, 0));
}

/** O horário `hour` está dentro da janela comercial? */
export function isBusinessHour(hour: number, policy: AntiBanPolicy): boolean {
  return hour >= policy.businessHoursStart && hour < policy.businessHoursEnd;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingDaily: number;
  reason?: string;
}

/** Verifica o limite diário do canal (fail-closed). */
export function checkDailyRate(
  policy: AntiBanPolicy,
  dayIndex: number,
  sentToday: number,
): RateLimitResult {
  const ceiling = warmupLimit(policy, dayIndex);
  const remaining = Math.max(ceiling - sentToday, 0);
  if (remaining <= 0) {
    return { allowed: false, remainingDaily: 0, reason: "limite_diario_atingido" };
  }
  return { allowed: true, remainingDaily: remaining };
}

/** Saúde do canal e kill-switch (Pilar 4) — fail-closed. */

export type ChannelStatus = "healthy" | "warning" | "critical";

export interface ChannelHealthInput {
  delivered: number;
  sent: number;
  rejected: number;
  readRate: number;
  replyRate: number;
  channelMin: number; // score mínimo (0-100)
  rejectionRateMax: number; // % máximo de rejeição
}

export interface ChannelHealth {
  score: number;
  status: ChannelStatus;
  rejectionRate: number;
  killSwitch: boolean;
  reasons: string[];
}

/** Score 0-100: entrega (30) + leitura (25) + resposta (25) + penalidade de rejeição (20). */
export function channelHealth(input: ChannelHealthInput): ChannelHealth {
  const reasons: string[] = [];
  const delivery = input.sent > 0 ? (input.delivered / input.sent) * 100 : 0;
  const rejection = input.sent > 0 ? (input.rejected / input.sent) * 100 : 0;

  let score = 0;
  score += (delivery / 100) * 30;
  score += (input.readRate / 100) * 25;
  score += (input.replyRate / 100) * 25;
  // rejeição zero → 20 pts; 100% → 0 pts
  score += Math.max(0, 1 - rejection / 100) * 20;

  let status: ChannelStatus = "healthy";
  if (rejection > input.rejectionRateMax) {
    status = "critical";
    reasons.push(`rejeicao_acima_do_limite:${rejection.toFixed(1)}%`);
  } else if (score < input.channelMin) {
    status = "critical";
    reasons.push(`score_abaixo_do_minimo:${score.toFixed(1)}`);
  } else if (score < input.channelMin + 10) {
    // faixa de warning: próximo do mínimo
    status = "warning";
    reasons.push(`score_proximo_do_minimo:${score.toFixed(1)}`);
  }

  const killSwitch = status === "critical";
  return {
    score: Math.round(score * 10) / 10,
    status,
    rejectionRate: rejection,
    killSwitch,
    reasons,
  };
}

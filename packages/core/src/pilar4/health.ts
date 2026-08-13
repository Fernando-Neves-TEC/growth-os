/** Saúde do canal e kill-switch (Pilar 4) — fail-closed. */

export type ChannelStatus = "no_data" | "healthy" | "warning" | "critical";

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
  /** null quando não há amostra suficiente de envios (sent <= 0). */
  score: number | null;
  status: ChannelStatus;
  rejectionRate: number;
  killSwitch: boolean;
  reasons: string[];
}

/** Score 0-100: entrega (30) + leitura (25) + resposta (25) + penalidade de rejeição (20). */
export function channelHealth(input: ChannelHealthInput): ChannelHealth {
  const reasons: string[] = [];

  // Sem dados de envio: contrato explícito de "no data" — nunca autopausa uma campanha nova.
  if (input.sent <= 0) {
    return { score: null, status: "no_data", rejectionRate: 0, killSwitch: false, reasons: ["sem_dados"] };
  }

  const delivery = (input.delivered / input.sent) * 100;
  const rejection = (input.rejected / input.sent) * 100;

  let score = 0;
  score += (delivery / 100) * 30;
  score += (input.readRate / 100) * 25;
  score += (input.replyRate / 100) * 25;
  // rejeição zero → 20 pts; 100% → 0 pts
  score += Math.max(0, 1 - rejection / 100) * 20;
  score = Math.min(100, score); // clamp defensivo (taxas anômalas nunca passam de 100)

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

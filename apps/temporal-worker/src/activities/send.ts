/** Activities (mock) do worker Temporal — envio simulado (nunca real em simulation). */

export interface SendResult {
  delivered: boolean;
  read: boolean;
  replied: boolean;
}

export async function sendMessage(plan: { leadId: string; channel: string; body: string }): Promise<SendResult> {
  // Simulação realista: replied implica read (replyRate <= readRate).
  const read = Math.random() < 0.53;
  return {
    delivered: true,
    read,
    replied: read && Math.random() < 0.375,
  };
}

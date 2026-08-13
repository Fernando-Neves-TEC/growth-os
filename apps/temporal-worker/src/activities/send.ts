/** Activities (mock) do worker Temporal — envio simulado (nunca real em simulation). */

export interface SendResult {
  delivered: boolean;
  read: boolean;
  replied: boolean;
}

export async function sendMessage(plan: { leadId: string; channel: string; body: string }): Promise<SendResult> {
  // Simulação com as probabilidades do funil âncora.
  return {
    delivered: true,
    read: Math.random() < 0.53,
    replied: Math.random() < 0.375,
  };
}

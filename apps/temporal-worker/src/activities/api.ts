/** Activities que consultam a API Growth OS (fonte única de verdade) e envios mock. */

const API = process.env.GROWTHOS_API_URL ?? "http://localhost:3000";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export interface KillSwitchState {
  paused: boolean;
  reason: string | null;
}

export interface SuppressionCheck {
  suppressed: boolean;
}

export interface EventPayload {
  eventId: string;
  type: string;
  cnpj?: string;
  channel?: string;
}

export interface SendResult {
  delivered: boolean;
  read: boolean;
  replied: boolean;
}

export async function getKillSwitch(): Promise<KillSwitchState> {
  return apiGet<KillSwitchState>("/channels/kill-switch");
}

export async function isSuppressed(cnpj: string): Promise<SuppressionCheck> {
  return apiGet<SuppressionCheck>(`/suppression/${encodeURIComponent(cnpj)}`);
}

export async function recordEvent(event: EventPayload): Promise<{ duplicate: boolean }> {
  return apiPost<{ duplicate: boolean }>("/events", event);
}

/** Envio simulado (nunca real em simulation). */
export async function sendMessage(plan: { leadId: string; channel: string; body: string }): Promise<SendResult> {
  return {
    delivered: true,
    read: Math.random() < 0.53,
    replied: Math.random() < 0.375,
  };
}

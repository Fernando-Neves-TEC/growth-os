/** Cliente HTTP da API Growth OS. */
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(body));
  }
  return res.json() as Promise<T>;
}

export interface Health {
  score: number;
  status: string;
  rejectionRate: number;
  killSwitch: boolean;
  reasons: string[];
}

export interface FunnelMetrics {
  counters: Record<string, number>;
  metrics: Record<string, number>;
  arr_projected: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
}

export const api = {
  health: () => req<Health>("/channels/health"),
  killSwitch: () => req<{ paused: boolean; reason: string | null }>("/channels/kill-switch"),
  pause: () => req("/channels/pause", { method: "POST", body: JSON.stringify({ reason: "manual" }) }),
  resume: () => req("/channels/resume", { method: "POST" }),
  metrics: () => req<FunnelMetrics>("/metrics/funnel"),
  createCampaign: (name: string, workflow: unknown) =>
    req<Campaign>("/campaigns", { method: "POST", body: JSON.stringify({ name, workflow }) }),
  listCampaigns: () => req<Campaign[]>("/campaigns"),
  simulateTurn: (id: string, event: unknown, currentNode: string | null) =>
    req(`/campaigns/${id}/simulate-turn`, { method: "POST", body: JSON.stringify({ event, currentNode }) }),
};

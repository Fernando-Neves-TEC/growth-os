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
  score: number | null;
  status: string;
  rejectionRate: number;
  killSwitch: boolean;
  reasons: string[];
}

export interface FunnelMetrics {
  counters: Record<string, number>;
  metrics: Record<string, number>;
  arr_projected: number;
  arr_params: { scheduleRate: number; closeRate: number; ticketMonthly: number };
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
}

export interface SuppressionEntry {
  cnpj: string;
  reason: string | null;
  createdAt: string;
}

export interface LeadItem {
  cnpj: string;
  companyName: string;
  state: string;
  icpFitScore: number;
  source: string;
}

export interface LeadsResponse {
  total: number;
  items: LeadItem[];
}

export interface PipelineRun {
  runId: string;
  region: string | null;
  collected: number;
  qualified: number;
  createdAt: string;
}

export interface EventResult {
  eventId: string;
  type: string;
  duplicate: boolean;
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
  suppression: {
    list: () => req<SuppressionEntry[]>("/suppression"),
    add: (cnpj: string, reason?: string) =>
      req("/suppression", { method: "POST", body: JSON.stringify({ cnpj, reason }) }),
  },
  leads: {
    list: (limit = 50) => req<LeadsResponse>(`/leads?limit=${limit}`),
    runs: (limit = 10) => req<PipelineRun[]>(`/leads/runs?limit=${limit}`),
  },
  ingestEvent: (eventId: string, type: string, cnpj?: string) =>
    req<EventResult>("/events", { method: "POST", body: JSON.stringify({ eventId, type, cnpj }) }),
};

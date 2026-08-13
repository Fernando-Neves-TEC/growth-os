/** Cliente HTTP da API Growth OS (S2).
 *  - NUNCA carrega a API key administrativa no navegador (sem VITE_API_KEY).
 *  - Autenticação humana via sessão (cookie HttpOnly) com credentials: "include".
 *  - CSRF: token por sessão obtido em login//auth/me; enviado em mutações. */
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

let csrfToken = "";

export function setCsrfToken(token: string): void {
  csrfToken = token;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const method = (init?.method ?? "GET").toUpperCase();
  if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(body));
  }
  return res.json() as Promise<T>;
}

export interface Operator {
  id: string;
  email: string;
  role: string;
}

export interface AuthPayload {
  operator: Operator;
  csrfToken: string;
  expiresAt: string;
}

export interface Health {
  score: number | null;
  status: string;
  rejectionRate: number;
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
  auth: {
    login: (email: string, password: string) =>
      req<AuthPayload>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    me: async (): Promise<AuthPayload | null> => {
      try {
        return await req<AuthPayload>("/auth/me");
      } catch {
        return null;
      }
    },
    logout: () => req("/auth/logout", { method: "POST" }),
  },
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

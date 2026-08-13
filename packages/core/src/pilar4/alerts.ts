/** Alertas e auto-pause (Pilar 4). */
import type { ChannelHealth } from "./health.js";

export type AlertLevel = "info" | "warning" | "critical";

export interface Alert {
  level: AlertLevel;
  rule: string;
  payload: Record<string, unknown>;
}

/** Avalia alertas a partir da saúde do canal. */
export function evaluateAlerts(health: ChannelHealth, campaignId: string): Alert[] {
  const alerts: Alert[] = [];
  const base = { campaignId, score: health.score, status: health.status };
  if (health.status === "critical") {
    alerts.push({ level: "critical", rule: "kill_switch", payload: { ...base, reasons: health.reasons } });
  } else if (health.status === "warning") {
    alerts.push({ level: "warning", rule: "channel_warning", payload: base });
  } else {
    alerts.push({ level: "info", rule: "channel_healthy", payload: base });
  }
  return alerts;
}

/** Kill-switch: pausa/reanuda campanhas. Fail-closed: pausa nunca é automática na retomada. */
export class KillSwitch {
  private pausedReason: string | null = null;

  get isPaused(): boolean {
    return this.pausedReason !== null;
  }

  get reason(): string | null {
    return this.pausedReason;
  }

  pause(reason: string): void {
    this.pausedReason = reason;
  }

  resume(): void {
    this.pausedReason = null;
  }
}

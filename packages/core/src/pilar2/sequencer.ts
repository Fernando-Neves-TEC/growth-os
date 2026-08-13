/** Sequenciador multicanal (S4) — planeja envios respeitando anti-ban e janela comercial. */
import type { AntiBanPolicy } from "./anti-ban.js";
import { checkDailyRate, isBusinessHour, jitterDelayMs, warmupLimit } from "./anti-ban.js";
import type { Channel } from "./types.js";

export interface PendingSend {
  leadId: string;
  channel: Channel;
  body: string;
}

export interface PlannedSend extends PendingSend {
  scheduledAt: Date;
}

export interface SkippedSend {
  leadId: string;
  channel: Channel;
  reason: string;
}

export interface DayPlan {
  sends: PlannedSend[];
  skipped: SkippedSend[];
}

/**
 * Sequenciador: agrupa por canal, aplica warm-up/limite diário por canal
 * e espalha os envios dentro da janela comercial com jitter.
 */
export class Sequencer {
  constructor(
    private readonly policy: AntiBanPolicy,
    private readonly rng: () => number = Math.random,
  ) {}

  planDay(pending: PendingSend[], dayIndex: number, date: Date): DayPlan {
    const sends: PlannedSend[] = [];
    const skipped: SkippedSend[] = [];

    const byChannel = new Map<Channel, PendingSend[]>();
    for (const p of pending) {
      const list = byChannel.get(p.channel) ?? [];
      list.push(p);
      byChannel.set(p.channel, list);
    }

    for (const [channel, items] of byChannel) {
      // limite diário por canal (warm-up progressivo)
      const ceiling = warmupLimit(this.policy, dayIndex);
      let sentToday = 0;
      const base = new Date(date);
      base.setHours(this.policy.businessHoursStart, 0, 0, 0);
      let cursor = base.getTime();

      for (const item of items) {
        const rate = checkDailyRate(this.policy, dayIndex, sentToday);
        if (!rate.allowed) {
          skipped.push({ leadId: item.leadId, channel, reason: rate.reason ?? "limite" });
          continue;
        }
        cursor += jitterDelayMs(this.policy, this.rng);
        const scheduled = new Date(cursor);
        if (!isBusinessHour(scheduled.getHours(), this.policy)) {
          skipped.push({ leadId: item.leadId, channel, reason: "fora_da_janela_comercial" });
          continue;
        }
        sends.push({ leadId: item.leadId, channel, body: item.body, scheduledAt: scheduled });
        sentToday += 1;
        void ceiling;
      }
    }

    sends.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    return { sends, skipped };
  }
}

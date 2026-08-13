import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  COUNTER_STORE,
  EVENT_STORE,
  SUPPRESSION_STORE,
  type CounterEventType,
  type CounterStore,
  type EventStore,
  type EventType,
  type FunnelEvent,
  type SuppressionStore,
} from "../persistence/stores.js";

const COUNTER_EVENTS: CounterEventType[] = ["sent", "delivered", "read", "replied", "qualified", "scheduled", "closed"];

@Injectable()
export class EventsService {
  constructor(
    @Inject(EVENT_STORE) private readonly events: EventStore,
    @Inject(COUNTER_STORE) private readonly counters: CounterStore,
    @Inject(SUPPRESSION_STORE) private readonly suppression: SuppressionStore,
  ) {}

  /** Ingestão idempotente de evento do funil (eventId único). */
  async process(input: { eventId: string; type: EventType; cnpj?: string; channel?: string }) {
    if (!input.eventId?.trim()) throw new BadRequestException("eventId é obrigatório");
    const type = input.type;
    const valid: EventType[] = [...COUNTER_EVENTS, "optout"];
    if (!valid.includes(type)) throw new BadRequestException(`tipo de evento inválido: ${type}`);
    if (type === "optout" && !input.cnpj) throw new BadRequestException("evento optout exige cnpj");

    const event: FunnelEvent = { eventId: input.eventId, type, cnpj: input.cnpj, channel: input.channel };
    const { duplicate } = await this.events.apply(event);

    if (!duplicate) {
      if (type === "optout") {
        await this.suppression.add(input.cnpj!, "opt_out_event");
      } else {
        await this.counters.increment(type);
      }
    }

    return { eventId: input.eventId, type, duplicate };
  }
}

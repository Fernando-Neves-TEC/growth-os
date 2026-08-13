import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { isValidCnpj } from "@growthos/core";
import {
  EVENT_STORE,
  type CounterEventType,
  type EventEffect,
  type EventStore,
  type EventType,
  type FunnelEvent,
} from "../persistence/stores.js";

const COUNTER_EVENTS: CounterEventType[] = ["sent", "delivered", "read", "replied", "qualified", "scheduled", "closed"];

@Injectable()
export class EventsService {
  constructor(@Inject(EVENT_STORE) private readonly events: EventStore) {}

  /** Ingestão de evento do funil: valida entrada e delega o efeito atômico ao sink (evento+contador/suppression). */
  async process(input: { eventId: string; type: EventType; cnpj?: string; channel?: string }) {
    if (!input.eventId?.trim()) throw new BadRequestException("eventId é obrigatório");
    const type = input.type;
    const valid: EventType[] = [...COUNTER_EVENTS, "optout"];
    if (!valid.includes(type)) throw new BadRequestException(`tipo de evento inválido: ${type}`);
    if (type === "optout") {
      if (!input.cnpj) throw new BadRequestException("evento optout exige cnpj");
      input.cnpj = input.cnpj.replace(/\D/g, "");
      if (!isValidCnpj(input.cnpj)) throw new BadRequestException("cnpj inválido");
    }

    const event: FunnelEvent = { eventId: input.eventId, type, cnpj: input.cnpj, channel: input.channel };
    const effect: EventEffect = type === "optout" ? "optout" : "counter";
    const { duplicate } = await this.events.apply(event, effect);
    return { eventId: input.eventId, type, duplicate };
  }
}

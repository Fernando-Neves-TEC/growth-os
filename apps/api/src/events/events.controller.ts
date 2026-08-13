import { Body, Controller, Inject, Post } from "@nestjs/common";
import type { EventType } from "../persistence/stores.js";
import { EventsService } from "./events.service.js";

@Controller("events")
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Post()
  async ingest(@Body() body: { eventId: string; type: EventType; cnpj?: string; channel?: string }) {
    return this.events.process(body);
  }
}

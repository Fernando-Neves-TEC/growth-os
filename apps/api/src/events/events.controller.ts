import { Body, Controller, Inject, Post } from "@nestjs/common";
import { z } from "zod";
import { zodBody } from "../validation/zod.pipe.js";
import { EventsService } from "./events.service.js";

const EventSchema = z.object({
  eventId: z.string().trim().min(1, "eventId obrigatório"),
  type: z.enum(["sent", "delivered", "read", "replied", "qualified", "scheduled", "closed", "optout"]),
  cnpj: z.string().optional(),
  channel: z.string().optional(),
});

@Controller("events")
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Post()
  async ingest(@Body(zodBody(EventSchema)) body: z.infer<typeof EventSchema>) {
    return this.events.process(body);
  }
}

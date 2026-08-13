import { Controller, Get, Inject, Query } from "@nestjs/common";
import { z } from "zod";
import { zodQuery } from "../validation/zod.pipe.js";
import { LeadsService } from "./leads.service.js";

const LeadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const RunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

@Controller("leads")
export class LeadsController {
  constructor(@Inject(LeadsService) private readonly leads: LeadsService) {}

  @Get()
  async list(@Query(zodQuery(LeadsQuerySchema)) q: z.infer<typeof LeadsQuerySchema>) {
    return this.leads.list(q.limit ?? 100, q.offset ?? 0);
  }

  @Get("runs")
  async runs(@Query(zodQuery(RunsQuerySchema)) q: z.infer<typeof RunsQuerySchema>) {
    return this.leads.runs(q.limit ?? 50);
  }
}

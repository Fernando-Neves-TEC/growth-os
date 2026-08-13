import { Controller, Get, Inject, Query } from "@nestjs/common";
import { LeadsService } from "./leads.service.js";

@Controller("leads")
export class LeadsController {
  constructor(@Inject(LeadsService) private readonly leads: LeadsService) {}

  @Get()
  async list(@Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.leads.list(Number(limit ?? 100), Number(offset ?? 0));
  }

  @Get("runs")
  async runs(@Query("limit") limit?: string) {
    return this.leads.runs(Number(limit ?? 50));
  }
}

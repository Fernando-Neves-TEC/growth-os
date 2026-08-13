import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { CampaignsService, type CreateCampaignInput, type PlanDayInput, type SimulateTurnInput } from "./campaigns.service.js";

@Controller("campaigns")
export class CampaignsController {
  constructor(@Inject(CampaignsService) private readonly campaigns: CampaignsService) {}

  @Get()
  list() {
    return this.campaigns.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.campaigns.get(id);
  }

  @Post()
  create(@Body() input: CreateCampaignInput) {
    return this.campaigns.create(input);
  }

  @Post(":id/plan-day")
  planDay(@Param("id") id: string, @Body() input: PlanDayInput) {
    return this.campaigns.planDay(id, input);
  }

  @Post(":id/simulate-turn")
  simulateTurn(@Param("id") id: string, @Body() input: SimulateTurnInput) {
    return this.campaigns.simulateTurn(id, input);
  }
}

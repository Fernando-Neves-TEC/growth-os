import { Body, Controller, Get, HttpStatus, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { z } from "zod";
import { zodBody } from "../validation/zod.pipe.js";
import { CampaignsService, type CreateCampaignInput, type PlanDayInput, type SimulateTurnInput, type StartCampaignInput } from "./campaigns.service.js";

const uuidParam = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND });

const CreateCampaignSchema = z.object({
  name: z.string().trim().min(1, "name obrigatório"),
  workflow: z.unknown(),
});

const StartCampaignSchema = z.object({
  plans: z
    .array(
      z.object({
        leadId: z.string().min(1).optional(),
        cnpj: z.string().optional(),
        channel: z.enum(["whatsapp", "email"]),
        body: z.string().min(1),
      }),
    )
    .min(1, "plans é obrigatório (array não-vazio)"),
});

const PlanDaySchema = z.object({
  leads: z.array(
    z.object({
      leadId: z.string().min(1),
      channel: z.enum(["whatsapp", "email"]),
      body: z.string().min(1),
    }),
  ),
  dayIndex: z.number().int().min(0).optional(),
});

const SimulateTurnSchema = z.object({
  event: z.unknown(),
  currentNode: z.string().nullable().optional(),
});

@Controller("campaigns")
export class CampaignsController {
  constructor(@Inject(CampaignsService) private readonly campaigns: CampaignsService) {}

  @Get()
  list() {
    return this.campaigns.list();
  }

  @Get(":id")
  get(@Param("id", uuidParam) id: string) {
    return this.campaigns.get(id);
  }

  @Post()
  create(@Body(zodBody(CreateCampaignSchema)) input: CreateCampaignInput) {
    return this.campaigns.create(input);
  }

  @Post(":id/plan-day")
  planDay(@Param("id", uuidParam) id: string, @Body(zodBody(PlanDaySchema)) input: PlanDayInput) {
    return this.campaigns.planDay(id, input);
  }

  @Post(":id/simulate-turn")
  simulateTurn(@Param("id", uuidParam) id: string, @Body(zodBody(SimulateTurnSchema)) input: SimulateTurnInput) {
    return this.campaigns.simulateTurn(id, input);
  }

  @Post(":id/start")
  start(@Param("id", uuidParam) id: string, @Body(zodBody(StartCampaignSchema)) input: StartCampaignInput) {
    return this.campaigns.start(id, input);
  }
}

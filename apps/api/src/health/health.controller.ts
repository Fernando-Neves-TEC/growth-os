import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { z } from "zod";
import { zodBody } from "../validation/zod.pipe.js";
import { HealthService } from "./health.service.js";

const PauseSchema = z.object({ reason: z.string().optional() });

@Controller("channels")
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get("health")
  status() {
    return this.health.channel();
  }

  @Get("kill-switch")
  killSwitch() {
    return this.health.killSwitchState();
  }

  @Post("pause")
  pause(@Body(zodBody(PauseSchema)) body: { reason?: string }) {
    return this.health.pause(body.reason ?? "manual");
  }

  @Post("resume")
  resume() {
    return this.health.resume();
  }
}

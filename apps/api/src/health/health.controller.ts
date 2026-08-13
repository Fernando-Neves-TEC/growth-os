import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { z } from "zod";
import { zodBody } from "../validation/zod.pipe.js";
import { Human, Public, Shared } from "../auth/auth.decorators.js";
import { HealthService } from "./health.service.js";

const PauseSchema = z.object({ reason: z.string().optional() });

@Controller("channels")
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Public()
  @Get("health")
  status() {
    // F-09: health público NÃO expõe estado administrativo (kill-switch).
    return this.health.publicStatus();
  }

  @Shared() // dashboard (sessão) e worker (M2M)
  @Get("kill-switch")
  killSwitch() {
    return this.health.killSwitchState();
  }

  @Human()
  @Post("pause")
  pause(@Body(zodBody(PauseSchema)) body: { reason?: string }) {
    return this.health.pause(body.reason ?? "manual");
  }

  @Human()
  @Post("resume")
  resume() {
    return this.health.resume();
  }
}

import { Controller, Get, Inject } from "@nestjs/common";
import { Human } from "../auth/auth.decorators.js";
import { StatusService } from "./status.service.js";

@Controller("status")
export class StatusController {
  constructor(@Inject(StatusService) private readonly status: StatusService) {}

  @Human()
  @Get()
  async get() {
    return this.status.get();
  }
}

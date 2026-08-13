import { Controller, Get, Inject } from "@nestjs/common";
import { StatusService } from "./status.service.js";

@Controller("status")
export class StatusController {
  constructor(@Inject(StatusService) private readonly status: StatusService) {}

  @Get()
  async get() {
    return this.status.get();
  }
}

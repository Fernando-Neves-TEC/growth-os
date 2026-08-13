import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { SUPPRESSION_STORE, type SuppressionStore } from "../persistence/stores.js";

@Controller("suppression")
export class SuppressionController {
  constructor(@Inject(SUPPRESSION_STORE) private readonly suppression: SuppressionStore) {}

  @Get()
  async list() {
    return this.suppression.list();
  }

  @Post()
  async add(@Body() body: { cnpj: string; reason?: string }) {
    const cnpj = (body.cnpj ?? "").replace(/\D/g, "");
    if (!cnpj) {
      return { error: "cnpj inválido" };
    }
    await this.suppression.add(cnpj, body.reason);
    return { cnpj, suppressed: true };
  }
}

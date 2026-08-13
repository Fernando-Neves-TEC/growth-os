import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { SUPPRESSION_STORE, type SuppressionStore } from "../persistence/stores.js";

@Controller("suppression")
export class SuppressionController {
  constructor(@Inject(SUPPRESSION_STORE) private readonly suppression: SuppressionStore) {}

  @Get()
  async list() {
    return this.suppression.list();
  }

  @Get(":cnpj")
  async contains(@Param("cnpj") cnpj: string) {
    const normalized = cnpj.replace(/\D/g, "");
    const suppressed = await this.suppression.contains(normalized);
    return { cnpj: normalized, suppressed };
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

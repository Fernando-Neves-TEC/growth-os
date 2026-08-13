import { BadRequestException, Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { isValidCnpj } from "@growthos/core";
import { z } from "zod";
import { Human, Shared } from "../auth/auth.decorators.js";
import { zodBody } from "../validation/zod.pipe.js";
import { SUPPRESSION_STORE, type SuppressionStore } from "../persistence/stores.js";

const AddSuppressionSchema = z.object({
  cnpj: z.string().min(1, "cnpj obrigatório"),
  reason: z.string().optional(),
});

@Controller("suppression")
export class SuppressionController {
  constructor(@Inject(SUPPRESSION_STORE) private readonly suppression: SuppressionStore) {}

  @Human()
  @Get()
  async list() {
    return this.suppression.list();
  }

  @Shared() // dashboard (sessão) e worker (M2M)
  @Get(":cnpj")
  async contains(@Param("cnpj") cnpj: string) {
    const normalized = cnpj.replace(/\D/g, "");
    const suppressed = await this.suppression.contains(normalized);
    return { cnpj: normalized, suppressed };
  }

  @Human()
  @Post()
  async add(@Body(zodBody(AddSuppressionSchema)) body: { cnpj: string; reason?: string }) {
    const cnpj = body.cnpj.replace(/\D/g, "");
    if (!isValidCnpj(cnpj)) {
      throw new BadRequestException("cnpj inválido");
    }
    await this.suppression.add(cnpj, body.reason);
    return { cnpj, suppressed: true };
  }
}

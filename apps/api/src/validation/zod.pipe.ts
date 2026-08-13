/** Validação de entrada estruturada por schema (H4) — substituto de guards manuais dispersos. */
import { BadRequestException, Injectable, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

export function zodBody<T>(schema: ZodSchema<T>): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}

export function zodQuery<T>(schema: ZodSchema<T>): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "payload inválido",
        errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
      });
    }
    return parsed.data;
  }
}

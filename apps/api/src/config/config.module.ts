import { Global, Module } from "@nestjs/common";
import { loadConfig, type GrowthConfig } from "@growthos/core";

export const GROWTH_CONFIG = Symbol("GROWTH_CONFIG");

@Global()
@Module({
  providers: [
    {
      provide: GROWTH_CONFIG,
      useFactory: (): GrowthConfig => loadConfig(process.env),
    },
  ],
  exports: [GROWTH_CONFIG],
})
export class ConfigModule {}

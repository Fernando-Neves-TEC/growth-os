import { Module } from "@nestjs/common";
import { SuppressionController } from "./suppression.controller.js";

@Module({
  controllers: [SuppressionController],
})
export class SuppressionModule {}

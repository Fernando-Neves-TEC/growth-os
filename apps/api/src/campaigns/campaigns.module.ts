import { Module } from "@nestjs/common";
import { CampaignsController } from "./campaigns.controller.js";
import { CampaignsService } from "./campaigns.service.js";
import { TemporalWorkflowLauncher, WORKFLOW_LAUNCHER } from "./workflow-launcher.js";

@Module({
  controllers: [CampaignsController],
  providers: [CampaignsService, { provide: WORKFLOW_LAUNCHER, useClass: TemporalWorkflowLauncher }],
  exports: [CampaignsService, WORKFLOW_LAUNCHER],
})
export class CampaignsModule {}

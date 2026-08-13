import { Injectable } from "@nestjs/common";
import {
  KillSwitch,
  SuppressionList,
  type ChannelHealthInput,
  type FunnelCounters,
  type Workflow,
} from "@growthos/core";

export interface CampaignRecord {
  id: string;
  name: string;
  workflow: Workflow;
  status: "draft" | "paused" | "active";
}

/** Estado em memória (modo simulação). Persistência real (PostgreSQL) entra na Fase 3. */
@Injectable()
export class InMemoryStore {
  readonly campaigns = new Map<string, CampaignRecord>();
  readonly killSwitch = new KillSwitch();
  readonly suppression = new SuppressionList();
  readonly counters: FunnelCounters = {
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    qualified: 0,
    scheduled: 0,
    closed: 0,
    rejected: 0,
  };
  healthInput: ChannelHealthInput = {
    delivered: 0,
    sent: 0,
    rejected: 0,
    readRate: 0,
    replyRate: 0,
    channelMin: 60,
    rejectionRateMax: 5,
  };
}

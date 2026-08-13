import { Inject, Injectable } from "@nestjs/common";
import { LEAD_STORE, type LeadStore } from "../persistence/stores.js";

@Injectable()
export class LeadsService {
  constructor(@Inject(LEAD_STORE) private readonly leads: LeadStore) {}

  async list(limit = 100, offset = 0) {
    const cap = Math.min(Math.max(limit || 100, 1), 500);
    const off = Math.max(offset || 0, 0);
    const [total, items] = await Promise.all([this.leads.countLeads(), this.leads.listLeads(cap, off)]);
    return { total, limit: cap, offset: off, items };
  }

  async runs(limit = 50) {
    return this.leads.listRuns(Math.min(Math.max(limit || 50, 1), 200));
  }
}

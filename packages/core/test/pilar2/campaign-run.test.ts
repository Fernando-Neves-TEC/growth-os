import { describe, expect, it } from "vitest";
import {
  executeCampaignRun,
  type CampaignPlanItem,
  type CampaignRunActivities,
  type CampaignRunInput,
} from "../../src/pilar2/campaign-run.js";
import type { Workflow } from "../../src/pilar2/workflow.js";

const SUPPRESSED = "11122233000111";

const okWorkflow: Workflow = {
  id: "wf", version: 1, name: "n", entry: "s1",
  nodes: [
    { id: "s1", type: "send", config: { channel: "whatsapp", body: "Olá" } },
    { id: "e", type: "end" },
  ],
  edges: [{ from: "s1", to: "e" }],
};

function plans(n: number): CampaignPlanItem[] {
  return Array.from({ length: n }, (_, i) => ({
    leadId: `lead-${i}`,
    cnpj: i === 0 ? SUPPRESSED : `111222330001${String(i).padStart(2, "0")}`,
    channel: "whatsapp" as const,
    body: `msg ${i}`,
  }));
}

type Act = CampaignRunActivities & { recorded: { eventId: string; type: string }[] };

function makeActivities(overrides: Partial<CampaignRunActivities> = {}): Act {
  const recorded: { eventId: string; type: string }[] = [];
  const base: Act = {
    getKillSwitch: async () => ({ paused: false, reason: null }),
    isSuppressed: async (cnpj) => ({ suppressed: cnpj === SUPPRESSED }),
    sendMessage: async () => ({ delivered: true, read: true, replied: true }),
    recordEvent: async (e) => { recorded.push({ eventId: e.eventId, type: e.type }); return { duplicate: false }; },
    recorded,
  };
  return { ...base, ...overrides, recorded };
}

describe("executeCampaignRun (executor puro de campanha)", () => {
  it("rejeita workflow inválido (fail-closed) sem despachar", async () => {
    const act = makeActivities();
    const out = await executeCampaignRun(
      { campaignId: "c1", workflow: { ...okWorkflow, entry: "nao-existe" }, plans: plans(2) },
      act,
    );
    expect(out.workflowValid).toBe(false);
    expect(out.validationErrors?.length).toBeGreaterThan(0);
    expect(out.dispatched).toBe(0);
    expect(act.recorded.length).toBe(0);
  });

  it("para no início quando kill-switch está pausado", async () => {
    const act = makeActivities({ getKillSwitch: async () => ({ paused: true, reason: "x" }) });
    const out = await executeCampaignRun({ campaignId: "c1", workflow: okWorkflow, plans: plans(3) }, act);
    expect(out.paused).toBe(true);
    expect(out.dispatched).toBe(0);
    expect(act.recorded.length).toBe(0);
  });

  it("pula lead suppressido sem enviar nem registrar evento", async () => {
    const act = makeActivities();
    const out = await executeCampaignRun({ campaignId: "c1", workflow: okWorkflow, plans: plans(2) }, act);
    // lead-0 suppressido
    expect(out.results[0].suppressed).toBe(true);
    expect(out.dispatched).toBe(1);
    const ids = act.recorded.map((e) => e.eventId);
    expect(ids.some((id) => id.includes("lead-0"))).toBe(false);
    expect(ids.some((id) => id.includes("lead-1-sent"))).toBe(true);
  });

  it("registra eventos em ordem canônica sent→delivered→read→replied por lead", async () => {
    const act = makeActivities();
    await executeCampaignRun({ campaignId: "c1", workflow: okWorkflow, plans: plans(2) }, act);
    const types = act.recorded.filter((e) => e.eventId.includes("lead-1")).map((e) => e.type);
    expect(types).toEqual(["sent", "delivered", "read", "replied"]);
  });

  it("interrompe novos envios quando o kill-switch é acionado no meio da execução (H5)", async () => {
    let calls = 0;
    const act = makeActivities({
      // chamada 1 = início; 2 = lead-0; 3 = lead-1 (despacha); 4 = lead-2 → pausado
      getKillSwitch: async () => {
        calls += 1;
        return { paused: calls >= 4, reason: calls >= 4 ? "interrupcao_meio" : null };
      },
    });
    const out = await executeCampaignRun({ campaignId: "c1", workflow: okWorkflow, plans: plans(5) }, act);
    expect(out.paused).toBe(true);
    // lead-0 suppressido, lead-1 despachado, lead-2 em diante NÃO
    expect(out.dispatched).toBe(1);
    expect(out.results.filter((r) => r.suppressed).length).toBe(1);
    expect(out.results.length).toBe(2); // 1 suppressed + 1 dispatched; parou antes dos demais
  });

  it("não registra replied quando o lead não respondeu", async () => {
    const act = makeActivities({
      sendMessage: async () => ({ delivered: true, read: true, replied: false }),
    });
    const out = await executeCampaignRun({ campaignId: "c1", workflow: okWorkflow, plans: plans(2) }, act);
    const types = act.recorded.filter((e) => e.eventId.includes("lead-1")).map((e) => e.type);
    expect(types).toContain("sent");
    expect(types).toContain("delivered");
    expect(types).toContain("read");
    expect(types).not.toContain("replied");
    expect(out.results[1].replied).toBe(false);
  });
});

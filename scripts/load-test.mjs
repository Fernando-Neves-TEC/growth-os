// Teste de carga simulado (S9) — valida sequenciador, anti-ban e kill-switch sob volume.
// Uso: node scripts/load-test.mjs   (após `npm run build --workspace=@growthos/core`)
import { Sequencer, channelHealth } from "@growthos/core";

const policy = {
  warmupDay1: 10,
  warmupStep: 5,
  warmupCeiling: 100,
  businessHoursStart: 9,
  businessHoursEnd: 18,
  jitterMinMs: 15_000,
  jitterMaxMs: 45_000,
};

function makeLeads(n) {
  return Array.from({ length: n }, (_, i) => ({
    leadId: `lead-${i}`,
    channel: "whatsapp",
    body: `Olá ${i}`,
  }));
}

// 1) Sequenciador sob carga: 5.000 leads/dia → apenas o teto (100) é enviado por canal
const seq = new Sequencer(policy, Math.random);
const plan = seq.planDay(makeLeads(5000), 7, new Date(2026, 0, 12, 8, 0));
console.log(`[sequencer] enviados=${plan.sends.length} (teto=${policy.warmupCeiling}) ` +
  `pulados=${plan.skipped.length} → ${plan.sends.length <= policy.warmupCeiling ? "OK" : "FALHOU"}`);

// 2) Kill-switch sob rejeição alta
const healthBad = channelHealth({
  delivered: 70, sent: 100, rejected: 20,
  readRate: 30, replyRate: 10,
  channelMin: 60, rejectionRateMax: 5,
});
console.log(`[kill-switch] status=${healthBad.status} killSwitch=${healthBad.killSwitch} ` +
  `reasons=${healthBad.reasons.join(",")} → ${healthBad.killSwitch ? "OK (pausado)" : "FALHOU"}`);

// 3) Kill-switch com canal saudável
const healthGood = channelHealth({
  delivered: 100, sent: 100, rejected: 0,
  readRate: 70, replyRate: 40,
  channelMin: 60, rejectionRateMax: 5,
});
console.log(`[health] status=${healthGood.status} score=${healthGood.score} → ${healthGood.killSwitch ? "FALHOU" : "OK"}`);

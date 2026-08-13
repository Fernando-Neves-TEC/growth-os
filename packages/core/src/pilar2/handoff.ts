/** Hand-off condicional (S4) — o bot só aciona o humano em casos previstos. */
import type { Intent } from "./types.js";

export interface HandoffInput {
  intent: Intent;
  objectionLoops: number;
  maxObjectionLoops: number;
  hasBaseAnswer: boolean;
}

export interface HandoffDecision {
  handoff: boolean;
  reason?: string;
}

export function shouldHandoff(input: HandoffInput): HandoffDecision {
  if (input.intent === "human") {
    return { handoff: true, reason: "pedido_humano" };
  }
  if (input.intent === "objection") {
    if (input.objectionLoops > input.maxObjectionLoops) {
      return { handoff: true, reason: "objecao_em_loop" };
    }
    if (!input.hasBaseAnswer) {
      return { handoff: true, reason: "objecao_sem_base" };
    }
  }
  return { handoff: false };
}

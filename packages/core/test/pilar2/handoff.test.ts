import { describe, expect, it } from "vitest";
import { shouldHandoff } from "../../src/pilar2/handoff.js";

describe("shouldHandoff (S4)", () => {
  it("escala quando o lead pede humano", () => {
    const d = shouldHandoff({ intent: "human", objectionLoops: 0, maxObjectionLoops: 2, hasBaseAnswer: true });
    expect(d.handoff).toBe(true);
    expect(d.reason).toBe("pedido_humano");
  });

  it("escala por objeção em loop", () => {
    const d = shouldHandoff({ intent: "objection", objectionLoops: 3, maxObjectionLoops: 2, hasBaseAnswer: true });
    expect(d.handoff).toBe(true);
    expect(d.reason).toBe("objecao_em_loop");
  });

  it("escala por objeção sem resposta na base", () => {
    const d = shouldHandoff({ intent: "objection", objectionLoops: 1, maxObjectionLoops: 2, hasBaseAnswer: false });
    expect(d.handoff).toBe(true);
    expect(d.reason).toBe("objecao_sem_base");
  });

  it("não escala em interesse", () => {
    const d = shouldHandoff({ intent: "interest", objectionLoops: 0, maxObjectionLoops: 2, hasBaseAnswer: true });
    expect(d.handoff).toBe(false);
  });

  it("objeção com resposta na base e abaixo do limite não escala", () => {
    const d = shouldHandoff({ intent: "objection", objectionLoops: 1, maxObjectionLoops: 2, hasBaseAnswer: true });
    expect(d.handoff).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { ConversationStateMachine } from "../../src/pilar2/state-machine.js";
import type { Workflow } from "../../src/pilar2/types.js";

const wf: Workflow = {
  id: "wf-2",
  version: 1,
  name: "funil",
  entry: "open",
  nodes: [
    { id: "open", type: "send", config: { channel: "whatsapp", body: "Olá!" } },
    { id: "cond", type: "condition", config: { branches: { interest: "offer", schedule: "book", optout: "out", human: "hand" }, default: "out" } },
    { id: "offer", type: "send", config: { channel: "whatsapp", body: "Veja nossa proposta." } },
    { id: "book", type: "send", config: { channel: "whatsapp", body: "Aguarde que agendamos." } },
    { id: "hand", type: "handoff", config: { reason: "humano" } },
    { id: "out", type: "optout" },
  ],
  edges: [
    { from: "open", to: "cond" },
    { from: "cond", to: "offer", on: "interest" },
    { from: "cond", to: "book", on: "schedule" },
    { from: "cond", to: "out", on: "optout" },
    { from: "cond", to: "hand", on: "human" },
  ],
};

describe("ConversationStateMachine (S3)", () => {
  it("start produz a mensagem de abertura", () => {
    const sm = new ConversationStateMachine(wf);
    const r = sm.step({ type: "start" }, null);
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toMatchObject({ type: "send", channel: "whatsapp" });
    expect(r.terminal).toBe(false);
  });

  it("resposta com intenção de interesse segue para a oferta", () => {
    const sm = new ConversationStateMachine(wf);
    const start = sm.step({ type: "start" }, null);
    const r = sm.step({ type: "reply", intent: "interest" }, start.nextNode);
    expect(r.actions.map((a) => a.type)).toEqual(["send"]);
    expect(r.actions[0]).toMatchObject({ body: "Veja nossa proposta." });
  });

  it("intenção de agendamento segue para o nó de booking", () => {
    const sm = new ConversationStateMachine(wf);
    const r = sm.step({ type: "reply", intent: "schedule" }, "cond");
    expect(r.actions[0]).toMatchObject({ body: "Aguarde que agendamos." });
  });

  it("intenção optout termina com optout", () => {
    const sm = new ConversationStateMachine(wf);
    const r = sm.step({ type: "reply", intent: "optout" }, "cond");
    expect(r.actions.map((a) => a.type)).toContain("optout");
    expect(r.terminal).toBe(true);
  });

  it("intenção human gera handoff", () => {
    const sm = new ConversationStateMachine(wf);
    const r = sm.step({ type: "reply", intent: "human" }, "cond");
    expect(r.actions.map((a) => a.type)).toContain("handoff");
    expect(r.terminal).toBe(true);
  });
});

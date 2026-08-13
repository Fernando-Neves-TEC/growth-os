import { describe, expect, it } from "vitest";
import type { Workflow } from "../../src/pilar2/types.js";
import { validateWorkflow } from "../../src/pilar2/workflow.js";

const valid: Workflow = {
  id: "wf-1",
  version: 1,
  name: "funil teste",
  entry: "s1",
  nodes: [
    { id: "s1", type: "send", config: { channel: "whatsapp", body: "Oi" } },
    { id: "c1", type: "condition", config: { branches: { interest: "s2", no_interest: "end1" }, default: "end1" } },
    { id: "s2", type: "send", config: { channel: "email", body: "Detalhes" } },
    { id: "end1", type: "end" },
  ],
  edges: [
    { from: "s1", to: "c1" },
    { from: "c1", to: "s2", on: "interest" },
    { from: "c1", to: "end1", on: "no_interest" },
  ],
};

describe("validateWorkflow (S3)", () => {
  it("aceita workflow válido", () => {
    const r = validateWorkflow(valid);
    expect(r.ok).toBe(true);
  });

  it("rejeita entry inexistente", () => {
    const r = validateWorkflow({ ...valid, entry: "nope" });
    expect(r.ok).toBe(false);
  });

  it("rejeita send sem body", () => {
    const bad = {
      ...valid,
      nodes: valid.nodes.map((n) => (n.id === "s1" ? { ...n, config: { channel: "whatsapp", body: " " } } : n)),
    };
    const r = validateWorkflow(bad);
    expect(r.ok).toBe(false);
  });

  it("rejeita condition apontando para nó inexistente", () => {
    const bad = {
      ...valid,
      nodes: valid.nodes.map((n) =>
        n.id === "c1" ? { ...n, config: { branches: { interest: "fantasma" } } } : n,
      ),
    };
    const r = validateWorkflow(bad);
    expect(r.ok).toBe(false);
  });

  it("rejeita workflow sem terminal", () => {
    const bad = { ...valid, nodes: valid.nodes.filter((n) => n.type !== "end") };
    const r = validateWorkflow(bad);
    expect(r.ok).toBe(false);
  });
});

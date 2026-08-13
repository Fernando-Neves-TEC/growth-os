import { describe, expect, it } from "vitest";
import { assertCanContact, SuppressionList } from "../../src/s9/compliance.js";

describe("compliance (S9)", () => {
  it("bloqueia lead em opt-out", () => {
    const list = new SuppressionList();
    list.add("12345678000190");
    const v = assertCanContact({ cnpj: "12345678000190", sentToday: 0, dailyCeiling: 100 }, list);
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("opt_out");
  });

  it("bloqueia ao atingir o teto diário", () => {
    const v = assertCanContact({ cnpj: "11111111000111", sentToday: 100, dailyCeiling: 100 }, new SuppressionList());
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("limite_diario_atingido");
  });

  it("permite contato dentro dos limites", () => {
    const v = assertCanContact({ cnpj: "11111111000111", sentToday: 10, dailyCeiling: 100 }, new SuppressionList());
    expect(v.allowed).toBe(true);
  });
});

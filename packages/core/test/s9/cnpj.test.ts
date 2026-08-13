import { describe, expect, it } from "vitest";
import { isValidCnpj } from "../../src/s9/compliance.js";

describe("isValidCnpj (validação de CNPJ)", () => {
  it("aceita CNPJs válidos com e sem máscara", () => {
    expect(isValidCnpj("12.345.678/0001-95")).toBe(true);
    expect(isValidCnpj("12345678000195")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("rejeita CNPJ com dígitos verificadores errados", () => {
    expect(isValidCnpj("12345678000190")).toBe(false);
    expect(isValidCnpj("12345678000199")).toBe(false);
  });

  it("rejeita tamanho errado e tudo igual", () => {
    expect(isValidCnpj("123")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
});

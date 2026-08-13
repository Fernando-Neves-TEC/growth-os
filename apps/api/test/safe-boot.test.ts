import { describe, expect, it } from "vitest";
import { assertSafeBoot } from "../src/config/safe-boot.js";

describe("assertSafeBoot (contrato de modos — C2 fail-closed)", () => {
  it("approved sem GROWTHOS_API_KEY → NÃO inicia (fail-closed)", () => {
    expect(() => assertSafeBoot({ GROWTHOS_MODE: "approved" })).toThrow(/exige GROWTHOS_API_KEY/);
  });

  it("approved com GROWTHOS_API_KEY → inicia", () => {
    const cfg = assertSafeBoot({ GROWTHOS_MODE: "approved", GROWTHOS_API_KEY: "k" });
    expect(cfg.mode).toBe("approved");
  });

  it("simulation sem chave → inicia (dev local, auth opcional)", () => {
    const cfg = assertSafeBoot({ GROWTHOS_MODE: "simulation" });
    expect(cfg.mode).toBe("simulation");
  });

  it("design sem chave → inicia", () => {
    const cfg = assertSafeBoot({ GROWTHOS_MODE: "design" });
    expect(cfg.mode).toBe("design");
  });
});

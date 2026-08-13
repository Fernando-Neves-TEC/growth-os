import { loadConfig, type GrowthConfig } from "@growthos/core";

/** Contrato explícito de modos (C2 — fail-closed):
 *  - `approved` (produção): EXIGE `GROWTHOS_API_KEY`. Sem credencial, a API se recusa a iniciar.
 *  - `simulation`/`design` (local): autenticação opcional (aberta apenas para dev local).
 *  Nenhuma configuração de produção pode iniciar sem credencial. */
export function assertSafeBoot(env: NodeJS.ProcessEnv = process.env): GrowthConfig {
  const cfg = loadConfig(env);
  const apiKey = env.GROWTHOS_API_KEY?.trim() ?? "";
  if (cfg.mode === "approved" && !apiKey) {
    throw new Error(
      "FALHA DE BOOT (fail-closed): GROWTHOS_MODE=approved exige GROWTHOS_API_KEY. " +
        "Sem credencial a API não inicia. Defina GROWTHOS_API_KEY ou use GROWTHOS_MODE=simulation/design.",
    );
  }
  return cfg;
}

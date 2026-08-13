/** Configuração consciente por ambiente (H6): CORS por allowlist/modo + limite de payload. */
import type { NestExpressApplication } from "@nestjs/platform-express";

export function configureApp(app: NestExpressApplication): void {
  app.useBodyParser("json", { limit: process.env.GROWTHOS_BODY_LIMIT ?? "100kb" });
  app.enableCors(corsOptions());
}

/** CORS: allowlist explícita via GROWTHOS_CORS_ORIGINS; approved sem allowlist → bloqueado (fail-closed). */
function corsOptions(): { origin: boolean | string[] } {
  const mode = process.env.GROWTHOS_MODE ?? "simulation";
  const raw = process.env.GROWTHOS_CORS_ORIGINS;
  if (raw) return { origin: raw.split(",").map((s) => s.trim()).filter(Boolean) };
  if (mode === "approved") return { origin: [] }; // fail-closed: nenhuma origem externa autorizada
  return { origin: true }; // dev local / simulação
}

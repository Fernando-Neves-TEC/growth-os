/** Configuração consciente por ambiente (H6/S2): CORS por allowlist/modo + limite de payload + cookies. */
import cookieParser from "cookie-parser";
import type { NestExpressApplication } from "@nestjs/platform-express";

export function configureApp(app: NestExpressApplication): void {
  app.use(cookieParser());
  app.useBodyParser("json", { limit: process.env.GROWTHOS_BODY_LIMIT ?? "100kb" });
  app.enableCors(corsOptions());
}

/** CORS: allowlist explícita via GROWTHOS_CORS_ORIGINS; approved sem allowlist → bloqueado (fail-closed).
 *  `credentials: true` permite cookies de sessão entre o dashboard e a API (mesma origem em produção). */
function corsOptions(): { origin: boolean | string[]; credentials: boolean } {
  const mode = process.env.GROWTHOS_MODE ?? "simulation";
  const raw = process.env.GROWTHOS_CORS_ORIGINS;
  if (raw) return { origin: raw.split(",").map((s) => s.trim()).filter(Boolean), credentials: true };
  if (mode === "approved") return { origin: [], credentials: false }; // fail-closed: nenhuma origem externa autorizada
  return { origin: true, credentials: true }; // dev local / simulação
}

/** Configuração consciente por ambiente (H6/S2): CORS por allowlist/modo + limite de payload + cookies. */
import cookieParser from "cookie-parser";
import type { NestExpressApplication } from "@nestjs/platform-express";

export function configureApp(app: NestExpressApplication): void {
  app.use(cookieParser());
  app.useBodyParser("json", { limit: process.env.GROWTHOS_BODY_LIMIT ?? "100kb" });
  app.enableCors(corsOptions());
}

/** CORS: allowlist explícita via GROWTHOS_CORS_ORIGINS; approved sem allowlist → bloqueado (fail-closed).
 *  Simulação/dev também é fail-closed: apenas origens LOCAIS do dashboard (nunca reflete origem arbitrária).
 *  `credentials: true` permite cookies de sessão entre o dashboard e a API (mesma origem em produção). */
const LOCAL_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function corsOptions(): { origin: boolean | string[]; credentials: boolean } {
  const mode = process.env.GROWTHOS_MODE ?? "simulation";
  const raw = process.env.GROWTHOS_CORS_ORIGINS;
  if (raw) return { origin: raw.split(",").map((s) => s.trim()).filter(Boolean), credentials: true };
  if (mode === "approved") return { origin: [], credentials: false }; // fail-closed: nenhuma origem externa autorizada
  return { origin: LOCAL_DEV_ORIGINS, credentials: true }; // simulação: apenas origens locais do dashboard
}

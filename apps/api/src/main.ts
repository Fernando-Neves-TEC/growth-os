import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { assertSafeBoot } from "./config/safe-boot.js";

async function bootstrap(): Promise<void> {
  // C2 — fail-closed: approved sem API key não inicia.
  const cfg = assertSafeBoot(process.env);
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`[growthos-api] listening on :${port} (modo ${cfg.mode})`);
}

void bootstrap();

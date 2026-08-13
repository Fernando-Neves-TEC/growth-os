import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`[growthos-api] listening on :${port} (modo ${process.env.GROWTHOS_MODE ?? "simulation"})`);
}

void bootstrap();

/** Bootstrap do worker Temporal. Conecta ao servidor local (docker compose) e
registra o task queue `growthos-campaign`. */
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities/send.js";

async function run(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";

  const connection = await NativeConnection.connect({ address });
  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue: "growthos-campaign",
    workflowsPath: require.resolve("./workflows/campaign.js"),
    activities,
  });

  console.log(`[growthos-temporal-worker] conectado a ${address} (namespace ${namespace})`);
  await worker.run();
}

run().catch((err) => {
  console.error("[growthos-temporal-worker] falha ao iniciar:", err);
  process.exit(1);
});

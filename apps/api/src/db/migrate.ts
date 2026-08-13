/** Runner de migrations (Fase 3) — aplica migrations/*.sql em ordem e registra em schema_migrations.
 * Concorrência: advisory lock no Postgres + transação por migration (nenhuma aplicação parcial).
 * Uso: npm run migrate --workspace=@growthos/api  (requer build prévio: node dist/db/migrate.js)
 */
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

const DEFAULT_DB_URL = "postgresql://growthos:growthos@localhost:5433/growthos";
const LOCK_KEY = 727_001; // chave arbitrária do Growth OS

async function migrate(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL ?? DEFAULT_DB_URL });
  await client.connect();

  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );

  // migrations/ fica na raiz do monorepo: <root>/apps/api/dist/db -> ../../../../migrations
  const migrationsDir = process.env.MIGRATIONS_DIR ?? resolve(__dirname, "../../../../migrations");
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
  try {
    for (const file of files) {
      const { rows } = await client.query<{ exists: boolean }>("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1) AS exists", [file]);
      if (rows[0]?.exists) continue;
      const sql = await readFile(resolve(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations(version) VALUES($1)", [file]);
        await client.query("COMMIT");
        console.log(`[migrate] aplicado: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
  }

  await client.end();
  console.log("[migrate] concluído.");
}

migrate().catch((err) => {
  console.error("[migrate] erro:", err);
  process.exit(1);
});

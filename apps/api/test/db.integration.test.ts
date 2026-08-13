/** Integração F3 — persistência durável no PostgreSQL real.
 * Prova que kill-switch e suppression sobrevivem a um "restart" (nova instância de store lendo o mesmo banco).
 * Requer Postgres de pé (docker compose) e migrations 003/004 aplicadas; pula se indisponível.
 */
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgCampaignStore, PgKillSwitchStore, PgSuppressionStore } from "../src/persistence/pg.stores.js";

const url = process.env.DATABASE_URL ?? "postgresql://growthos:growthos@localhost:5433/growthos";

async function tryPool(): Promise<Pool | null> {
  const pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 3000 });
  try {
    await pool.query("SELECT 1");
    return pool;
  } catch {
    await pool.end().catch(() => undefined);
    return null;
  }
}

describe("Persistência durável (F3, integração Postgres)", () => {
  it("kill-switch e suppression sobrevivem a restart (nova instância de store)", async () => {
    const pool = await tryPool();
    if (!pool) {
      console.warn("[db.integration] Postgres indisponível — teste ignorado");
      return;
    }

    // kill-switch: escreve via instância A, lê via instância B (simula restart)
    const ksA = new PgKillSwitchStore(pool);
    await ksA.set({ paused: true, reason: "restart-test" });
    const ksB = new PgKillSwitchStore(pool);
    const state = await ksB.get();
    expect(state.paused).toBe(true);
    expect(state.reason).toBe("restart-test");
    await ksA.set({ paused: false, reason: null }); // limpeza

    // suppression: adiciona via A, verifica via B, remove ao final
    const supA = new PgSuppressionStore(pool);
    const cnpj = "99999999000199";
    await supA.add(cnpj, "audit-restart");
    const supB = new PgSuppressionStore(pool);
    expect(await supB.contains(cnpj)).toBe(true);
    await pool.query("DELETE FROM suppression WHERE cnpj = $1", [cnpj]);
    expect(await supB.contains(cnpj)).toBe(false);

    await pool.end();
  });

  it("campanha round-trip JSONB: create → get → setStatus (regressão do double-parse)", async () => {
    const pool = await tryPool();
    if (!pool) {
      console.warn("[db.integration] Postgres indisponível — teste ignorado");
      return;
    }
    const store = new PgCampaignStore(pool);
    const rec = {
      id: randomUUID(),
      name: "roundtrip-jsonb",
      workflow: {
        id: "wf-rt", version: 1, name: "n", entry: "s1",
        nodes: [
          { id: "s1", type: "send", config: { channel: "whatsapp", body: "oi" } },
          { id: "e", type: "end" },
        ],
        edges: [{ from: "s1", to: "e" }],
      },
      status: "draft" as const,
    };
    await store.create(rec);
    const got = await store.get(rec.id);
    expect(got).not.toBeNull();
    expect(got!.workflow.id).toBe("wf-rt"); // JSONB já é objeto; nunca "[object Object]"
    expect(got!.status).toBe("draft");
    const listed = await store.list();
    expect(listed.some((c) => c.id === rec.id)).toBe(true);
    await store.setStatus(rec.id, "active");
    expect((await store.get(rec.id))!.status).toBe("active");
    await pool.query("DELETE FROM campaigns WHERE id = $1", [rec.id]);
    await pool.end();
  });
});

/** Integração H1 — atomicidade de evento + efeito derivado (contador/optout) no PostgreSQL.
 * Prova o contrato "1 evento lógico → 1 efeito lógico", inclusive sob retry e concorrência.
 * Requer Postgres (docker compose) com migrations 006/007. No CI (GROWTHOS_DB_TEST_REQUIRED=1),
 * a ausência do banco FALHA o teste (nunca "pula silenciosamente" em gate verde).
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PgEventStore } from "../src/persistence/pg.stores.js";

const url = process.env.DATABASE_URL ?? "postgresql://growthos:growthos@localhost:5433/growthos";

async function connect(): Promise<Pool> {
  const pool = new Pool({ connectionString: url, max: 6, connectionTimeoutMillis: 3000 });
  try {
    await pool.query("SELECT 1");
    return pool;
  } catch {
    await pool.end().catch(() => undefined);
    if (process.env.GROWTHOS_DB_TEST_REQUIRED === "1") {
      throw new Error("Postgres necessário para testes de integração (GROWTHOS_DB_TEST_REQUIRED=1)");
    }
    console.warn("[events.atomic] Postgres indisponível — teste ignorado (local sem banco)");
    return null as unknown as Pool;
  }
}

const COUNTER_COLS = "sent, delivered, read, replied, qualified, scheduled, closed, rejected";

describe("Atomicidade de eventos (H1, integração Postgres)", () => {
  let pool: Pool;
  let store: PgEventStore;
  let originalCounters: Record<string, number> | null = null;

  beforeAll(async () => {
    pool = await connect();
    store = new PgEventStore(pool);
    // Teste hermenético: zera os contadores do funil e remove eventos do teste (restaura depois).
    const { rows } = await pool.query(`SELECT ${COUNTER_COLS} FROM funnel_counters WHERE id = 1`);
    originalCounters = rows[0] ?? null;
    await pool.query(`UPDATE funnel_counters SET ${COUNTER_COLS.split(",").map((c) => `${c.trim()}=0`).join(", ")} WHERE id = 1`);
    await pool.query("DELETE FROM events WHERE event_id LIKE 'atomic-%'");
  });

  afterAll(async () => {
    if (originalCounters) {
      await pool
        .query(
          `UPDATE funnel_counters SET ${COUNTER_COLS.split(",").map((c) => `${c.trim()}=$${COUNTER_COLS.split(",").indexOf(c) + 1}`).join(", ")} WHERE id = 1`,
          COUNTER_COLS.split(",").map((c) => originalCounters![c.trim()]),
        )
        .catch(() => undefined);
    }
    await pool?.query("DELETE FROM events WHERE event_id LIKE 'atomic-%'").catch(() => undefined);
    await pool?.query("DELETE FROM suppression WHERE cnpj = '98765432000188'").catch(() => undefined);
    await pool?.end().catch(() => undefined);
  });

  it("caso normal: evento novo → contador incrementa uma vez", async () => {
    const r = await store.apply({ eventId: "atomic-ok-1", type: "sent" }, "counter");
    expect(r.duplicate).toBe(false);
    const { rows } = await pool.query("SELECT sent FROM funnel_counters WHERE id = 1");
    expect(rows[0].sent).toBe(1);
    const ev = await pool.query("SELECT 1 FROM events WHERE event_id = 'atomic-ok-1'");
    expect(ev.rowCount).toBe(1);
  });

  it("duplicado: mesmo eventId não incrementa novamente", async () => {
    const before = (await pool.query("SELECT sent FROM funnel_counters WHERE id = 1")).rows[0].sent;
    const r2 = await store.apply({ eventId: "atomic-ok-1", type: "sent" }, "counter");
    expect(r2.duplicate).toBe(true);
    const after = (await pool.query("SELECT sent FROM funnel_counters WHERE id = 1")).rows[0].sent;
    expect(after).toBe(before);
  });

  it("falha: evento fora de ordem faz ROLLBACK (evento NÃO fica órfão, contador intacto)", async () => {
    // sent (ok) — read fora de ordem (delivered=0 no estado zerado → deve falhar e reverter)
    await store.apply({ eventId: "atomic-chain-1", type: "sent" }, "counter");
    const before = (await pool.query("SELECT read FROM funnel_counters WHERE id = 1")).rows[0].read;
    await expect(store.apply({ eventId: "atomic-chain-2", type: "read" }, "counter")).rejects.toThrow();
    const ev = await pool.query("SELECT 1 FROM events WHERE event_id = 'atomic-chain-2'");
    expect(ev.rowCount).toBe(0); // não persistido (rollback)
    const after = (await pool.query("SELECT read FROM funnel_counters WHERE id = 1")).rows[0].read;
    expect(after).toBe(before); // contador intacto
  });

  it("concorrência: duas requisições com mesmo eventId → um único efeito", async () => {
    const eventId = "atomic-conc-1";
    const before = (await pool.query("SELECT sent FROM funnel_counters WHERE id = 1")).rows[0].sent;
    const results = await Promise.all([
      store.apply({ eventId, type: "sent" }, "counter"),
      store.apply({ eventId, type: "sent" }, "counter"),
    ]);
    expect(results.filter((r) => !r.duplicate).length).toBe(1);
    expect(results.filter((r) => r.duplicate).length).toBe(1);
    const after = (await pool.query("SELECT sent FROM funnel_counters WHERE id = 1")).rows[0].sent;
    expect(after).toBe(before + 1);
  });

  it("optout: evento + suppression na mesma transação", async () => {
    const r = await store.apply({ eventId: "atomic-opt-1", type: "optout", cnpj: "98765432000188" }, "optout");
    expect(r.duplicate).toBe(false);
    const sup = await pool.query("SELECT 1 FROM suppression WHERE cnpj = '98765432000188'");
    expect(sup.rowCount).toBe(1);
  });
});

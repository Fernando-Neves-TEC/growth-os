/** S2/S10 — persistência de sessão e auditoria no PostgreSQL (sessão sobrevive a restart da API). */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { PgOperatorsStore, PgSecurityAuditStore, PgSessionStore } from "../src/auth/pg.stores.js";
import { SecurityAuditService } from "../src/auth/security-audit.service.js";

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
    console.warn("[auth.session] Postgres indisponível — teste ignorado (local sem banco)");
    return null as unknown as Pool;
  }
}

describe("S2/S10 — persistência de sessão e auditoria (integração Postgres)", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await connect();
    await pool
      .query("DELETE FROM sessions WHERE operator_id IN (SELECT id FROM operators WHERE email = 'restart@test.local')")
      .catch(() => undefined);
    await pool.query("DELETE FROM operators WHERE email = 'restart@test.local'").catch(() => undefined);
  });

  afterAll(async () => {
    await pool?.query("DELETE FROM sessions WHERE operator_id IN (SELECT id FROM operators WHERE email = 'restart@test.local')").catch(() => undefined);
    await pool?.query("DELETE FROM operators WHERE email = 'restart@test.local'").catch(() => undefined);
    await pool?.end().catch(() => undefined);
  });

  it("login → sessão persiste e sobrevive a 'restart' (nova instância de stores lendo o mesmo banco)", async () => {
    const opsA = new PgOperatorsStore(pool);
    const sstA = new PgSessionStore(pool);
    const astA = new PgSecurityAuditStore(pool);
    const authA = new AuthService(opsA, sstA, new SecurityAuditService(astA));
    await authA.createOperator("restart@test.local", "SenhaRestart1!");
    const session = await authA.login({ email: "restart@test.local", password: "SenhaRestart1!" }, {});

    // "restart": nova instância de stores (novo processo) lê a mesma sessão
    const opsB = new PgOperatorsStore(pool);
    const sstB = new PgSessionStore(pool);
    const astB = new PgSecurityAuditStore(pool);
    const authB = new AuthService(opsB, sstB, new SecurityAuditService(astB));
    const resolved = await authB.resolveSession(session.sessionToken, {});
    expect(resolved).not.toBeNull();
    expect(resolved!.operator.email).toBe("restart@test.local");
    expect(resolved!.csrfToken).toBe(session.csrfToken);

    // logout via B revoga; A não resolve mais (sessão reutilizada após logout → null)
    await authB.logout(session.sessionToken, {});
    expect(await authA.resolveSession(session.sessionToken, {})).toBeNull();
  });

  it("eventos de auditoria persistem no Postgres, são consultáveis e não contêm valores de segredo", async () => {
    const ast = new PgSecurityAuditStore(pool);
    const list = await ast.list(100);
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((e) => e.event === "AUTH_LOGIN_SUCCESS")).toBe(true);
    for (const e of list) {
      const blob = JSON.stringify(e);
      // nenhum valor de segredo (senha real) e nenhuma connection string
      expect(blob).not.toContain("SenhaRestart1!");
      expect(blob).not.toMatch(/postgres:\/\/|connectionstring/i);
      // nenhuma chave/metadado sensível
      for (const key of Object.keys(e.metadata ?? {})) {
        expect(key.toLowerCase()).not.toMatch(/password|apikey|api_key|token|csrf|session|connection/);
      }
    }
  });
});

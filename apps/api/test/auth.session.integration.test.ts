/** S2/S10 — persistência de sessão e auditoria no PostgreSQL (sessão sobrevive a restart da API). */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService, hashToken } from "../src/auth/auth.service.js";
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
    for (const email of ["restart@test.local", "revoke@test.local"]) {
      await pool
        .query("DELETE FROM sessions WHERE operator_id IN (SELECT id FROM operators WHERE email = $1)", [email])
        .catch(() => undefined);
      await pool.query("DELETE FROM operators WHERE email = $1", [email]).catch(() => undefined);
    }
  });

  afterAll(async () => {
    for (const email of ["restart@test.local", "revoke@test.local"]) {
      await pool?.query("DELETE FROM sessions WHERE operator_id IN (SELECT id FROM operators WHERE email = $1)", [email]).catch(() => undefined);
      await pool?.query("DELETE FROM operators WHERE email = $1", [email]).catch(() => undefined);
    }
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

  it("SECURITY CLOSURE (baixo B): resolveSession atualiza last_seen_at (touch amortizado)", async () => {
    const ops = new PgOperatorsStore(pool);
    const sst = new PgSessionStore(pool);
    const ast = new PgSecurityAuditStore(pool);
    const auth = new AuthService(ops, sst, new SecurityAuditService(ast));
    await auth.createOperator("revoke@test.local", "SenhaRevoke1!");
    const s = await auth.login({ email: "revoke@test.local", password: "SenhaRevoke1!" }, {});
    // envelhece last_seen_at para passar da janela de amortização (1 min) e provar o update
    await pool.query("UPDATE sessions SET last_seen_at = now() - interval '2 minutes' WHERE token_hash = $1", [hashToken(s.sessionToken)]);
    const resolved = await auth.resolveSession(s.sessionToken, {});
    expect(resolved).not.toBeNull();
    const row = await pool.query("SELECT last_seen_at, created_at FROM sessions WHERE token_hash = $1", [hashToken(s.sessionToken)]);
    const last = new Date(row.rows[0].last_seen_at).getTime();
    const created = new Date(row.rows[0].created_at).getTime();
    expect(last).toBeGreaterThan(created);
  });

  it("SECURITY CLOSURE: revokeAllSessions derruba TODAS as sessões e audita reason=revoke_all", async () => {
    const ops = new PgOperatorsStore(pool);
    const sst = new PgSessionStore(pool);
    const ast = new PgSecurityAuditStore(pool);
    const auth = new AuthService(ops, sst, new SecurityAuditService(ast));
    await auth.createOperator("revoke@test.local", "SenhaRevoke1!");
    const a = await auth.login({ email: "revoke@test.local", password: "SenhaRevoke1!" }, {});
    const b = await auth.login({ email: "revoke@test.local", password: "SenhaRevoke1!" }, {});
    expect(await auth.resolveSession(a.sessionToken, {})).not.toBeNull();
    expect(await auth.resolveSession(b.sessionToken, {})).not.toBeNull();
    await auth.revokeAllSessions("revoke@test.local", {});
    expect(await auth.resolveSession(a.sessionToken, {})).toBeNull();
    expect(await auth.resolveSession(b.sessionToken, {})).toBeNull();
    // auditoria: AUTH_LOGOUT com reason=revoke_all e actorOperatorId do operador
    const events = await ast.list(100);
    const revoke = events.find((e) => e.event === "AUTH_LOGOUT" && e.metadata?.reason === "revoke_all");
    expect(revoke).toBeDefined();
    expect(revoke!.actorOperatorId).toBe((await ops.findByEmail("revoke@test.local"))!.id);
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

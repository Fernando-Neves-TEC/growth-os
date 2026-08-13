/** CLI administrativa LOCAL (S2/SECURITY CLOSURE): revoga TODAS as sessões ativas de um operador.
 *  NÃO exposto por HTTP (mitigação de vazamento/troca de senha). Não recebe segredos.
 *  Uso: npm run admin:revoke-sessions --workspace=@growthos/api <email>
 *  Registra evento de auditoria AUTH_LOGOUT (reason=revoke_all) no banco.
 */
import { Client } from "pg";

const DEFAULT_DB_URL = "postgresql://growthos:growthos@localhost:5433/growthos";

async function main(): Promise<void> {
  const email = (process.argv[2] ?? process.env.GROWTHOS_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("uso: node dist/admin/revoke-sessions.js <email>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL ?? process.env.GROWTHOS_DB_URL ?? DEFAULT_DB_URL;
  const client = new Client({ connectionString: url });
  await client.connect();

  const operator = await client.query("SELECT id FROM operators WHERE lower(email) = lower($1)", [email]);
  if ((operator.rowCount ?? 0) === 0) {
    console.error(`operador não encontrado: ${email}`);
    await client.end();
    process.exit(1);
  }
  const operatorId = operator.rows[0].id as string;

  const revoked = await client.query(
    "UPDATE sessions SET revoked_at = now() WHERE operator_id = $1 AND revoked_at IS NULL RETURNING id",
    [operatorId],
  );
  const count = revoked.rowCount ?? 0;

  await client.query(
    `INSERT INTO security_audit_events (event, actor_operator_id, path, metadata)
     VALUES ('AUTH_LOGOUT', $1, 'cli:admin:revoke-sessions', $2::jsonb)`,
    [operatorId, JSON.stringify({ reason: "revoke_all", email })],
  );

  console.log(`sessões revogadas de ${email}: ${count}`);
  await client.end();
}

main().catch((err: Error) => {
  console.error("erro:", err.message);
  process.exit(1);
});

/** CLI administrativa LOCAL (S2): cria o primeiro operador humano.
 *  NÃO exposto por HTTP. Senha nunca hardcoded; nunca imprime senha/hash.
 *  Uso: npm run admin:create --workspace=@growthos/api <email>   (senha via prompt ou GROWTHOS_ADMIN_PASSWORD)
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { hashPassword } from "../auth/password.js";

const DEFAULT_DB_URL = "postgresql://growthos:growthos@localhost:5433/growthos";

function promptHidden(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = "";
    stdout.write(promptText);
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (buf: Buffer): void => {
      for (const ch of buf.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
        } else {
          value += ch;
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const email = process.argv[2] ?? process.env.GROWTHOS_ADMIN_EMAIL;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("uso: node dist/admin/create-admin.js <email>   (senha via prompt ou GROWTHOS_ADMIN_PASSWORD)");
    process.exit(1);
  }
  let password = process.env.GROWTHOS_ADMIN_PASSWORD;
  if (!password) {
    password = await promptHidden("Senha (mín 8, não será exibida): ");
  }
  if (!password || password.length < 8) {
    console.error("senha muito curta (mínimo 8 caracteres)");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL ?? process.env.GROWTHOS_DB_URL ?? DEFAULT_DB_URL;
  const client = new Client({ connectionString: url });
  await client.connect();
  const existing = await client.query("SELECT 1 FROM operators WHERE lower(email) = lower($1)", [email]);
  if ((existing.rowCount ?? 0) > 0) {
    console.error(`operador já existe: ${email.toLowerCase()}`);
    await client.end();
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  await client.query(
    "INSERT INTO operators (id, email, password_hash, role, active) VALUES ($1, $2, $3, 'admin', true)",
    [randomUUID(), email.toLowerCase(), passwordHash],
  );
  console.log(`operador criado: ${email.toLowerCase()} (role=admin)`);
  await client.end();
}

main().catch((err: Error) => {
  console.error("erro:", err.message);
  process.exit(1);
});

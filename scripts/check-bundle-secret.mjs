/** S2 — prova automatizada de que a credencial administrativa NÃO está no bundle do frontend.
 *  Uso (após build com canary): VITE_API_KEY=CANARY... node scripts/check-bundle-secret.mjs
 *  Sai com código != 0 se a canary aparecer em qualquer artefato de apps/web/dist. */
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const canary = process.env.VITE_API_KEY;
if (!canary) {
  console.error("VITE_API_KEY ausente — defina a canary de teste antes de rodar a verificação");
  process.exit(2);
}

const dist = resolve(process.cwd(), "apps/web/dist");
let found = false;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(p);
    } else if (/\.(js|mjs|html)$/.test(entry.name)) {
      const content = await readFile(p, "utf8");
      if (content.includes(canary)) {
        found = true;
        console.error("SEGREDO ADMINISTRATIVO NO BUNDLE:", p);
      }
    }
  }
}

await walk(dist);
if (found) {
  console.error("S2 FAIL: credencial administrativa exposta no artefato cliente.");
  process.exit(1);
}
console.log("S2 OK: credencial administrativa não está no bundle do frontend.");

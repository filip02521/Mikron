/**
 * Testowe konto serwisanta w LOKALNEJ bazie (rola `serwis`): `serwis.test@ontime.local`.
 * Hasło bierze z SERWIS_TEST_PASSWORD w .env.local; bez niego generuje losowe i dopisuje je tam
 * (plik jest w .gitignore). Na bazie spoza localhost odmawia.
 *
 *   npx tsx scripts/seed-serwis-test.ts
 */
import { randomBytes, randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { Client } from "pg";
import { hashPassword } from "../src/lib/auth-local/password";
import { loadScriptEnv } from "./lib/db-client";
import { isLocalPostgresUrl } from "./lib/verify-pg";

const EMAIL = "serwis.test@ontime.local";

async function main() {
  loadScriptEnv();
  const url = process.env.DATABASE_URL ?? "";
  if (!isLocalPostgresUrl(url)) throw new Error("DATABASE_URL nie wskazuje lokalnej bazy — konta testowego nie zakładam.");
  let password = process.env.SERWIS_TEST_PASSWORD?.trim() ?? "";
  if (!password) {
    password = randomBytes(9).toString("base64url");
    appendFileSync(".env.local", `\n# Testowe konto serwisu (lokalnie, scripts/seed-serwis-test.ts): ${EMAIL}\nSERWIS_TEST_PASSWORD=${password}\n`);
    console.log("Hasło zapisane w .env.local jako SERWIS_TEST_PASSWORD.");
  }
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    await c.query("BEGIN");
    const hash = await hashPassword(password);
    const existing = await c.query<{ id: string }>(`SELECT id FROM app_users WHERE email = $1`, [EMAIL]);
    const id = existing.rows[0]?.id ?? randomUUID();
    if (existing.rows[0]) {
      await c.query(`UPDATE app_users SET password_hash = $2, updated_at = now() WHERE id = $1`, [id, hash]);
    } else {
      // Trigger na app_users zakłada wiersz profiles — profil tylko aktualizujemy.
      await c.query(`INSERT INTO app_users (id, email, password_hash, email_confirmed_at) VALUES ($1, $2, $3, now())`, [id, EMAIL, hash]);
    }
    const prof = await c.query(
      `UPDATE profiles SET role = 'serwis', email = $2, must_change_password = false WHERE id = $1`,
      [id, EMAIL]
    );
    if (prof.rowCount === 0) {
      await c.query(`INSERT INTO profiles (id, email, role, must_change_password) VALUES ($1, $2, 'serwis', false)`, [id, EMAIL]);
    }
    await c.query("COMMIT");
    console.log(`OK: ${EMAIL} (rola serwis) — konto TESTOWE, tylko lokalna baza.`);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Testowe konto handlowca-kierownika w LOKALNEJ bazie (rola `sales_manager`: widzi ekrany handlowca i zespołu):
 * `handlowiec.test@ontime.local`. Hasło bierze z SALES_TEST_PASSWORD w .env.local; bez niego generuje losowe i dopisuje
 * je tam (plik jest w .gitignore). Na bazie spoza localhost odmawia.
 *
 *   npx tsx scripts/seed-sales-test.ts
 */
import { randomBytes, randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { Client } from "pg";
import { hashPassword } from "../src/lib/auth-local/password";
import { loadScriptEnv } from "./lib/db-client";
import { isLocalPostgresUrl } from "./lib/verify-pg";

const EMAIL = "handlowiec.test@ontime.local";
const ROLE = "sales_manager";

async function main() {
  loadScriptEnv();
  const url = process.env.DATABASE_URL ?? "";
  if (!isLocalPostgresUrl(url)) throw new Error("DATABASE_URL nie wskazuje lokalnej bazy — konta testowego nie zakładam.");
  let password = process.env.SALES_TEST_PASSWORD?.trim() ?? "";
  if (!password) {
    password = randomBytes(9).toString("base64url");
    appendFileSync(".env.local", `\n# Testowe konto handlowca (lokalnie, scripts/seed-sales-test.ts): ${EMAIL}\nSALES_TEST_PASSWORD=${password}\n`);
    console.log("Hasło zapisane w .env.local jako SALES_TEST_PASSWORD.");
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
      `UPDATE profiles SET role = $3, email = $2, must_change_password = false WHERE id = $1`,
      [id, EMAIL, ROLE]
    );
    if (prof.rowCount === 0) {
      await c.query(`INSERT INTO profiles (id, email, role, must_change_password) VALUES ($1, $2, $3, false)`, [id, EMAIL, ROLE]);
    }
    // Profil handlowca bez grupy (nie wpada do prawdziwych zespołów); bez niego /moje mówi „Konto nie jest powiązane”.
    const person = await c.query<{ id: string }>(`SELECT id FROM sales_people WHERE email = $1`, [EMAIL]);
    const personId = person.rows[0]?.id ?? randomUUID();
    if (!person.rows[0]) {
      await c.query(`INSERT INTO sales_people (id, name, email, group_id) VALUES ($1, $2, $3, NULL)`, [personId, "Handlowiec Test", EMAIL]);
    }
    await c.query(`UPDATE profiles SET sales_person_id = $2, sales_onboarding_completed_at = coalesce(sales_onboarding_completed_at, now()) WHERE id = $1`, [id, personId]);
    await c.query("COMMIT");
    console.log(`OK: ${EMAIL} (rola ${ROLE}) — konto TESTOWE, tylko lokalna baza.`);
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

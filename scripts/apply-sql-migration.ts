/**
 * Uruchamia pojedynczy plik SQL na lokalnym PostgreSQL.
 * Preferuj `npm run db:migrate` dla pełnego łańcucha migracji.
 *
 * Użycie: npx tsx scripts/apply-sql-migration.ts db/migrations/0001_app_auth.sql
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { loadScriptEnv, requireDatabaseUrl } from "./lib/db-client";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error(
      "Podaj ścieżkę do pliku SQL, np. db/migrations/0001_app_auth.sql\n" +
        "Pełna migracja: npm run db:migrate"
    );
    process.exit(1);
  }

  const sqlPath = join(root, file);
  if (!existsSync(sqlPath)) {
    console.error("Brak pliku:", sqlPath);
    process.exit(1);
  }

  loadScriptEnv();
  const connectionString = requireDatabaseUrl();
  const sql = readFileSync(sqlPath, "utf-8");

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK:", file);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

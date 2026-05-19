/**
 * Uruchamia pojedynczy plik SQL na bazie Supabase (PostgreSQL).
 * Wymaga hasła do bazy w .env.local:
 *   SUPABASE_DB_PASSWORD=...   (z Supabase → Settings → Database)
 * lub pełnego DATABASE_URL.
 *
 * Użycie: npx tsx scripts/apply-sql-migration.ts supabase/migrations/012_sales_invite_metadata.sql
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal(): Record<string, string> {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

function buildConnectionString(env: Record<string, string>): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const password = env.SUPABASE_DB_PASSWORD;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!password || !url) {
    throw new Error(
      "Ustaw SUPABASE_DB_PASSWORD lub DATABASE_URL w .env.local (Supabase → Settings → Database)."
    );
  }

  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!m) throw new Error("Nie rozpoznano ref projektu z NEXT_PUBLIC_SUPABASE_URL");
  const ref = m[1];

  const host =
    env.SUPABASE_DB_HOST ?? `aws-0-eu-central-1.pooler.supabase.com`;
  const port = env.SUPABASE_DB_PORT ?? "5432";
  const user = env.SUPABASE_DB_USER ?? `postgres.${ref}`;

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Podaj ścieżkę do pliku SQL, np. supabase/migrations/012_sales_invite_metadata.sql");
    process.exit(1);
  }

  const sqlPath = join(root, file);
  if (!existsSync(sqlPath)) {
    console.error("Brak pliku:", sqlPath);
    process.exit(1);
  }

  const env = { ...process.env, ...loadEnvLocal() } as Record<string, string>;
  const sql = readFileSync(sqlPath, "utf-8");
  const connectionString = buildConnectionString(env);

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`\n=== Migracja: ${file} ===\n`);
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK — migracja wykonana.\n");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

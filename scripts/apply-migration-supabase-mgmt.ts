/**
 * DDL przez Supabase Management API (wymaga SUPABASE_ACCESS_TOKEN).
 * Token: https://supabase.com/dashboard/account/tokens
 *
 * Użycie:
 *   SUPABASE_ACCESS_TOKEN=sbp_... npx tsx scripts/apply-migration-supabase-mgmt.ts supabase/migrations/058_individual_orders_sales_request_note.sql
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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

function projectRefFromUrl(url: string): string {
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!m) throw new Error("Nie rozpoznano ref projektu z NEXT_PUBLIC_SUPABASE_URL");
  return m[1]!;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Podaj ścieżkę do pliku SQL.");
    process.exit(1);
  }

  const sqlPath = join(root, file);
  if (!existsSync(sqlPath)) {
    console.error("Brak pliku:", sqlPath);
    process.exit(1);
  }

  const env = { ...process.env, ...loadEnvLocal() } as Record<string, string>;
  const token = env.SUPABASE_ACCESS_TOKEN?.trim();
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!token) {
    console.error(
      "Brak SUPABASE_ACCESS_TOKEN — ustaw token z https://supabase.com/dashboard/account/tokens\n" +
        "lub użyj wtyczki Supabase (apply_migration) / SUPABASE_DB_PASSWORD + scripts/apply-sql-migration.ts"
    );
    process.exit(1);
  }
  if (!url) {
    console.error("Brak NEXT_PUBLIC_SUPABASE_URL w .env.local");
    process.exit(1);
  }

  const ref = projectRefFromUrl(url);
  const sql = readFileSync(sqlPath, "utf-8");

  console.log(`\n=== Migracja (Management API): ${file} ===\n`);

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, body);
    process.exit(1);
  }

  console.log("OK — migracja wykonana.");
  if (body.trim()) console.log(body);
  console.log();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

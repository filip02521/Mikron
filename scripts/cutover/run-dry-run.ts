/**
 * Dry-run cutover Supabase → lokalny PostgreSQL (plan §6.0, zał. R).
 *
 * Eksport (źródło Supabase):
 *   npx tsx scripts/cutover/run-dry-run.ts export
 *
 * Import (cel DATABASE_MIGRATE_URL):
 *   npx tsx scripts/cutover/run-dry-run.ts import
 *
 * Pełny cykl:
 *   npx tsx scripts/cutover/run-dry-run.ts full
 *
 * Wymaga w .env.local: archived supabase DATABASE_URL lub SUPABASE_DB_PASSWORD + URL
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import pg from "pg";
import { loadCutoverEnv, resolveSupabaseDbUrl, resolveSupabaseStorageCredentials, resolveTargetDbUrl } from "./lib/env";

const CUTOVER_DIR = join(process.cwd(), "data", "cutover");
const SNAPSHOT_FILE = join(CUTOVER_DIR, "counts-source.json");
const AUTH_CSV = join(CUTOVER_DIR, "auth_users_export.csv");
const PUBLIC_DUMP = join(CUTOVER_DIR, "public-data.dump");
const PUBLIC_SQL = join(CUTOVER_DIR, "public-data.sql");

function stripIncompatibleSessionSettings(sqlPath: string) {
  let sql = readFileSync(sqlPath, "utf-8");
  sql = sql.replace(/^SET transaction_timeout = .*;\n/gm, "");
  writeFileSync(sqlPath, sql);
}

/** pg_dump/pg_restore muszą być >= wersji serwera Supabase (obecnie PG 17). */
function pgBin(name: "pg_dump" | "pg_restore" | "psql"): string {
  const pg17 = `/opt/homebrew/opt/postgresql@17/bin/${name}`;
  if (existsSync(pg17)) return pg17;
  return name;
}

function run(cmd: string, args: string[], env: Record<string, string> = process.env as Record<string, string>) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) {
    throw new Error(`${cmd} failed with exit ${r.status}`);
  }
}

async function snapshotCounts(client: pg.Client): Promise<Record<string, number>> {
  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const counts: Record<string, number> = {};
  for (const { tablename } of rows) {
    const { rows: c } = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.${tablename}`
    );
    counts[tablename] = Number(c[0]?.n ?? 0);
  }
  const { rows: authRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM auth.users`
  );
  counts["__auth_users"] = Number(authRows[0]?.n ?? 0);
  return counts;
}

async function exportAuthCsv(client: pg.Client, path: string) {
  const { rows } = await client.query<{
    id: string;
    email: string;
    encrypted_password: string;
    email_confirmed_at: string | null;
    created_at: string;
    raw_user_meta_data: unknown;
  }>(
    `SELECT id, email, encrypted_password, email_confirmed_at, created_at, raw_user_meta_data
     FROM auth.users
     ORDER BY created_at`
  );
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    "id,email,encrypted_password,email_confirmed_at,created_at,raw_user_meta_data",
    ...rows.map(
      (r) =>
        [
          esc(r.id),
          esc(r.email),
          esc(r.encrypted_password),
          esc(r.email_confirmed_at),
          esc(r.created_at),
          esc(r.raw_user_meta_data),
        ].join(",")
    ),
  ];
  writeFileSync(path, lines.join("\n") + "\n");
  console.log(`auth CSV: ${rows.length} użytkowników → ${path}`);
}

async function phaseExport() {
  mkdirSync(CUTOVER_DIR, { recursive: true });
  const env = loadCutoverEnv();
  const sourceUrl = resolveSupabaseDbUrl(env);

  console.log("=== EXPORT ze Supabase ===");
  const client = new pg.Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const counts = await snapshotCounts(client);
    writeFileSync(SNAPSHOT_FILE, JSON.stringify(counts, null, 2));
    console.log(`snapshot: ${Object.keys(counts).length} tabel → ${SNAPSHOT_FILE}`);
    console.log(
      `  profiles=${counts.profiles ?? 0}, individual_orders=${counts.individual_orders ?? 0}, auth.users=${counts.__auth_users ?? 0}`
    );
    await exportAuthCsv(client, AUTH_CSV);

    const { rows: storageRows } = await client.query<{ bucket_id: string; name: string }>(
      `SELECT bucket_id, name FROM storage.objects WHERE name IS NOT NULL ORDER BY bucket_id, name`
    );
    writeFileSync(
      join(CUTOVER_DIR, "storage-objects.json"),
      JSON.stringify(storageRows, null, 2)
    );
    console.log(`storage manifest: ${storageRows.length} obiektów`);
  } finally {
    await client.end();
  }

  run(pgBin("pg_dump"), [
    "--data-only",
    "--no-owner",
    "--no-acl",
    "-n",
    "public",
    "-f",
    PUBLIC_SQL,
    sourceUrl,
  ]);
  stripIncompatibleSessionSettings(PUBLIC_SQL);

  const sizeMb = (readFileSync(PUBLIC_SQL).length / (1024 * 1024)).toFixed(2);
  console.log(`public SQL: ${PUBLIC_SQL} (${sizeMb} MB)`);
  console.log("\nEXPORT OK");
}

async function phaseImport() {
  const env = loadCutoverEnv();
  const targetUrl = resolveTargetDbUrl(env);
  process.env.DATABASE_URL = targetUrl;
  process.env.DATABASE_MIGRATE_URL = targetUrl;

  if (!existsSync(SNAPSHOT_FILE) || !existsSync(AUTH_CSV) || !existsSync(PUBLIC_SQL)) {
    throw new Error("Brak artefaktów export — uruchom najpierw: run-dry-run.ts export");
  }

  console.log("=== IMPORT do lokalnego PostgreSQL ===");
  console.log(`cel: ${targetUrl.replace(/:[^:@]+@/, ":***@")}`);

  run(pgBin("psql"), [targetUrl, "-v", "ON_ERROR_STOP=1", "-f", "scripts/cutover/truncate-public.sql"]);

  run("npx", ["tsx", "scripts/cutover/import-app-users.ts", "--csv", AUTH_CSV], {
    DATABASE_URL: targetUrl,
    DATABASE_MIGRATE_URL: targetUrl,
  });

  run(pgBin("psql"), [targetUrl, "-v", "ON_ERROR_STOP=1", "-f", PUBLIC_SQL]);

  run(pgBin("psql"), [targetUrl, "-c", "ANALYZE;"]);

  run("npx", ["tsx", "scripts/cutover/verify-counts.ts", "--source", SNAPSHOT_FILE], {
    DATABASE_URL: targetUrl,
  });

  run(pgBin("psql"), [targetUrl, "-f", "scripts/cutover/sanity-sql.sql"]);

  console.log("\nIMPORT OK");
  console.log("Następnie: npm run cutover:storage && smoke test §6.4");
}

async function phaseStorage() {
  const env = loadCutoverEnv();
  const manifest = join(CUTOVER_DIR, "storage-objects.json");
  if (!existsSync(manifest)) {
    console.error("Brak storage-objects.json — uruchom export");
    process.exit(1);
  }
  const { url, key } = resolveSupabaseStorageCredentials(env);
  run("npx", ["tsx", "scripts/migrate-storage-from-supabase.ts", "--manifest", manifest], {
    NEXT_PUBLIC_SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: key,
    STORAGE_ROOT: env.STORAGE_ROOT?.trim() || "./.storage-dev",
  });
}

async function main() {
  const phase = process.argv[2] || "full";
  if (phase === "export") {
    await phaseExport();
    return;
  }
  if (phase === "import") {
    await phaseImport();
    return;
  }
  if (phase === "storage") {
    await phaseStorage();
    return;
  }
  if (phase === "full") {
    await phaseExport();
    await phaseImport();
    await phaseStorage();
    return;
  }
  console.error("Użycie: export | import | storage | full");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

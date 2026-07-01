/**
 * Weryfikuje migracje 080–082 na podłączonej bazie Supabase.
 * Użycie: npx tsx scripts/verify-teeth-migrations-080-082.ts
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

function loadEnvLocal(): Record<string, string> {
  const path = join(process.cwd(), ".env.local");
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

function buildPgConnectionString(env: Record<string, string>): string | null {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const password = env.SUPABASE_DB_PASSWORD;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!password || !url) return null;

  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!m) return null;
  const ref = m[1];
  const host = env.SUPABASE_DB_HOST ?? "aws-0-eu-central-1.pooler.supabase.com";
  const port = env.SUPABASE_DB_PORT ?? "5432";
  const user = env.SUPABASE_DB_USER ?? `postgres.${ref}`;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
}

type Check = { id: string; ok: boolean; detail: string };

async function main() {
  const env = { ...process.env, ...loadEnvLocal() } as Record<string, string>;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const checks: Check[] = [];

  const { error: e080 } = await supabase
    .from("individual_order_teeth_details")
    .select("jaw")
    .limit(0);
  checks.push({
    id: "080",
    ok: !e080?.message?.includes("jaw"),
    detail: e080?.message?.includes("jaw")
      ? "brak kolumny individual_order_teeth_details.jaw"
      : e080
        ? e080.message
        : "individual_order_teeth_details.jaw",
  });

  const { error: e081 } = await supabase
    .from("individual_order_teeth_details")
    .select("kind")
    .limit(0);
  checks.push({
    id: "081",
    ok: !e081?.message?.includes("kind"),
    detail: e081?.message?.includes("kind")
      ? "brak kolumny individual_order_teeth_details.kind"
      : e081
        ? e081.message
        : "individual_order_teeth_details.kind",
  });

  const { error: e082k } = await supabase.from("prosba_teeth_products").select("kind").limit(0);
  checks.push({
    id: "082 (product_kind)",
    ok: !e082k?.message?.includes("kind"),
    detail: e082k?.message?.includes("kind")
      ? "brak kolumny prosba_teeth_products.kind"
      : e082k
        ? e082k.message
        : "prosba_teeth_products.kind",
  });

  const pgConn = buildPgConnectionString(env);
  if (pgConn) {
    const client = new pg.Client({ connectionString: pgConn, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const policies = await client.query<{ polname: string }>(
        `SELECT polname FROM pg_policy
         WHERE polrelid = 'public.individual_order_teeth_details'::regclass
         ORDER BY polname`,
      );
      const names = policies.rows.map((r) => r.polname);
      const hasPolicy = names.includes("individual_order_teeth_details_sales_own");
      checks.push({
        id: "082 (details_sales_rls)",
        ok: hasPolicy,
        detail: hasPolicy
          ? "polityka individual_order_teeth_details_sales_own"
          : `brak polityki (obecne: ${names.join(", ") || "—"})`,
      });
    } finally {
      await client.end();
    }
  } else {
    checks.push({
      id: "082 (details_sales_rls)",
      ok: false,
      detail: "pominięto — brak SUPABASE_DB_PASSWORD / DATABASE_URL",
    });
  }

  for (const c of checks) {
    console.log(`${c.ok ? "✓" : "✗"} migracja ${c.id} — ${c.detail}`);
  }

  const missing = checks.filter((c) => !c.ok).map((c) => c.id);
  if (missing.length) {
    console.log(`\nBrakujące: ${missing.join(", ")}`);
    process.exit(2);
  }
  console.log("\nWszystkie migracje 080–082 są wdrożone.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

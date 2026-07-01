/**
 * Weryfikuje migracje 083–086 na podłączonej bazie Supabase.
 * Użycie: npx tsx scripts/verify-teeth-migrations-083-086.ts
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

  const { error: e083 } = await supabase
    .from("prosba_teeth_products")
    .select("product_line")
    .limit(0);
  checks.push({
    id: "083",
    ok: !e083?.message?.includes("product_line"),
    detail: e083?.message?.includes("product_line")
      ? "brak kolumny product_line"
      : e083
        ? e083.message
        : "prosba_teeth_products.product_line",
  });

  const { error: e084 } = await supabase.from("teeth_order_history").select("id").limit(0);
  checks.push({
    id: "084",
    ok: !e084?.message?.includes("teeth_order_history"),
    detail: e084?.message?.includes("teeth_order_history")
      ? "brak tabeli teeth_order_history"
      : e084
        ? e084.message
        : "teeth_order_history",
  });

  const { error: e086 } = await supabase
    .from("individual_orders")
    .select("teeth_line_delivered")
    .limit(0);
  checks.push({
    id: "086",
    ok: !e086?.message?.includes("teeth_line_delivered"),
    detail: e086?.message?.includes("teeth_line_delivered")
      ? "brak kolumny teeth_line_delivered"
      : e086
        ? e086.message
        : "individual_orders.teeth_line_delivered",
  });

  const pgConn = buildPgConnectionString(env);
  if (pgConn) {
    const client = new pg.Client({ connectionString: pgConn, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const fn = await client.query<{ def: string }>(
        `SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname = 'can_access_teeth_panel' LIMIT 1`,
      );
      const def = fn.rows[0]?.def ?? "";
      checks.push({
        id: "085",
        ok: def.includes("zakupy_zeby"),
        detail: def.includes("zakupy_zeby")
          ? "can_access_teeth_panel (admin + zakupy_zeby)"
          : "funkcja can_access_teeth_panel bez zakupy_zeby lub brak",
      });
    } finally {
      await client.end();
    }
  } else {
    checks.push({
      id: "085",
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
  console.log("\nWszystkie migracje 083–086 są wdrożone.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Weryfikuje migracje 083–086 na podłączonej bazie PostgreSQL.
 * Użycie: npx tsx scripts/verify-teeth-migrations-083-086.ts
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createAdminClient as createClient } from "../src/lib/db/admin";
import {
  createVerifyPgClient,
  isRlsDisabledOnPublic,
} from "./lib/verify-pg";

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
  return env.DATABASE_URL?.trim() || null;
}

type Check = { id: string; ok: boolean; detail: string };

async function main() {
  const env = { ...process.env, ...loadEnvLocal() } as Record<string, string>;
  if (!env.DATABASE_URL?.trim()) {
    console.error("Brak DATABASE_URL (.env / .env.local)");
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;

  const supabase = createClient();
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
    const client = createVerifyPgClient(pgConn);
    await client.connect();
    try {
      if (await isRlsDisabledOnPublic(client)) {
        checks.push({
          id: "085",
          ok: true,
          detail: "RLS wyłączone (local PG / app-auth) — can_access_teeth_panel w app layer",
        });
      } else {
        const fn = await client.query<{ def: string }>(
          `SELECT pg_get_functiondef(oid) AS def
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE p.proname = 'can_access_teeth_panel'
             AND n.nspname IN ('public', 'private')
           LIMIT 1`,
        );
        const def = fn.rows[0]?.def ?? "";
        checks.push({
          id: "085",
          ok: def.includes("zakupy_zeby"),
          detail: def.includes("zakupy_zeby")
            ? "can_access_teeth_panel (admin + zakupy_zeby)"
            : "funkcja can_access_teeth_panel bez zakupy_zeby lub brak",
        });
      }
    } finally {
      await client.end();
    }
  } else {
    checks.push({
      id: "085",
      ok: false,
      detail: "pominięto — brak DATABASE_URL",
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

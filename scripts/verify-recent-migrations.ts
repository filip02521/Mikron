/**
 * Weryfikuje migracje 059–070 na podłączonej bazie Supabase.
 * Użycie: npx tsx scripts/verify-recent-migrations.ts
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

async function checkColumn(
  supabase: ReturnType<typeof createClient>,
  column: string,
  migrationLabel: string
): Promise<boolean> {
  const { error } = await supabase.from("individual_orders").select(column).limit(0);
  if (error?.message?.includes(column)) {
    console.error(`✗ Brak kolumny ${column} — uruchom migrację ${migrationLabel}.`);
    return false;
  }
  if (error) {
    console.error(`✗ Błąd sprawdzania ${migrationLabel}:`, error.message);
    return false;
  }
  return true;
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() } as Record<string, string>;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  let failed = false;

  const markFail = () => {
    failed = true;
  };

  if (await checkColumn(supabase, "sales_cancelled_quantity", "059")) {
    console.log("✓ migracja 059 — individual_orders.sales_cancelled_quantity");
  } else markFail();

  const { error: otpError } = await supabase.from("password_reset_otps").select("id").limit(0);
  if (otpError?.message?.includes("password_reset_otps")) {
    console.error("✗ Brak tabeli password_reset_otps — uruchom migrację 060.");
    markFail();
  } else if (otpError) {
    console.error("✗ Błąd sprawdzania 060:", otpError.message);
    markFail();
  } else {
    console.log("✓ migracja 060 — password_reset_otps");
  }

  const { error: rateError } = await supabase.from("auth_rate_limit_events").select("id").limit(0);
  if (rateError?.message?.includes("auth_rate_limit_events")) {
    console.error("✗ Brak tabeli auth_rate_limit_events — uruchom migrację 061.");
    markFail();
  } else if (rateError) {
    console.error("✗ Błąd sprawdzania 061:", rateError.message);
    markFail();
  } else {
    console.log("✓ migracja 061 — auth_rate_limit_events");
  }

  if (await checkColumn(supabase, "warehouse_cancel_fulfilled_at", "062")) {
    console.log("✓ migracja 062 — individual_orders.warehouse_cancel_fulfilled_at");
  } else markFail();

  if (await checkColumn(supabase, "procurement_cancel_note", "063")) {
    console.log("✓ migracja 063 — individual_orders.procurement_cancel_note");
  } else markFail();

  const cols067 = [
    "zd_fulfillment_previous_deadline",
    "zd_fulfillment_deadline_changed_at",
    "zd_fulfillment_deadline_change_seen_at",
  ] as const;
  let ok067 = true;
  for (const col of cols067) {
    if (!(await checkColumn(supabase, col, "067"))) ok067 = false;
  }
  if (ok067) {
    console.log(
      "✓ migracja 067 — individual_orders zd_fulfillment_*_deadline_change"
    );
  } else markFail();

  const pgConn = buildPgConnectionString(env);
  if (pgConn) {
    const client = new pg.Client({ connectionString: pgConn, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const policies = await client.query<{ polname: string }>(
        `SELECT polname FROM pg_policy
         WHERE polrelid = 'public.supplier_subiekt_kh_aliases'::regclass
         ORDER BY polname`
      );
      const policyNames = policies.rows.map((r) => r.polname);
      const expected068 = [
        "supplier_subiekt_kh_aliases_admin",
        "supplier_subiekt_kh_aliases_operations_read",
      ];
      const missing068 = expected068.filter((name) => !policyNames.includes(name));
      if (missing068.length) {
        console.error(
          `✗ Brak polityk RLS 068 na supplier_subiekt_kh_aliases: ${missing068.join(", ")}`
        );
        markFail();
      } else {
        console.log("✓ migracja 068 — supplier_subiekt_kh_aliases RLS");
      }

      const fn069 = await client.query<{ proname: string }>(
        `SELECT proname FROM pg_proc
         WHERE proname IN ('my_managed_group_ids', 'manager_can_access_sales_person')`
      );
      const fnNames = new Set(fn069.rows.map((r) => r.proname));
      if (!fnNames.has("my_managed_group_ids") || !fnNames.has("manager_can_access_sales_person")) {
        console.error("✗ Brak funkcji migracji 069 (my_managed_group_ids / manager_can_access_sales_person).");
        markFail();
      } else {
        const canRead = await client.query<{ def: string }>(
          `SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname = 'can_read_sales_order' LIMIT 1`
        );
        const def = canRead.rows[0]?.def ?? "";
        if (!def.includes("manager_can_access_sales_person")) {
          console.error("✗ can_read_sales_order nie zawiera scope kierownika — uruchom migrację 069.");
          markFail();
        } else {
          console.log("✓ migracja 069 — sales_manager scoped RLS");
        }
      }

      const spPolicies = await client.query<{ polname: string }>(
        `SELECT polname FROM pg_policy
         WHERE polrelid = 'public.sales_people'::regclass
         ORDER BY polname`
      );
      const spPolicyNames = spPolicies.rows.map((r) => r.polname);
      if (spPolicyNames.includes("sales_read_sales_people")) {
        console.error("✗ Nadal aktywna polityka sales_read_sales_people — uruchom migrację 070.");
        markFail();
      }
      const expected070 = [
        "sales_rep_read_own_sales_person",
        "sales_manager_read_team_sales_people",
      ];
      const missing070 = expected070.filter((name) => !spPolicyNames.includes(name));
      if (missing070.length) {
        console.error(`✗ Brak polityk RLS 070 na sales_people: ${missing070.join(", ")}`);
        markFail();
      } else {
        const isSalesRep = await client.query<{ proname: string }>(
          `SELECT proname FROM pg_proc WHERE proname = 'is_sales_rep'`
        );
        if (!isSalesRep.rows.length) {
          console.error("✗ Brak funkcji is_sales_rep — uruchom migrację 070.");
          markFail();
        } else {
          console.log("✓ migracja 070 — sales_people scoped RLS");
        }
      }

      const ioPolicies = await client.query<{ polname: string }>(
        `SELECT polname FROM pg_policy
         WHERE polrelid = 'public.individual_orders'::regclass
         ORDER BY polname`
      );
      const ioPolicyNames = ioPolicies.rows.map((r) => r.polname);
      const expected071 = ["sales_team_orders_update", "sales_team_orders_delete"];
      const missing071 = expected071.filter((name) => !ioPolicyNames.includes(name));
      if (missing071.length) {
        console.error(`✗ Brak polityk RLS 071 na individual_orders: ${missing071.join(", ")}`);
        markFail();
      } else {
        console.log("✓ migracja 071 — individual_orders sales UPDATE/DELETE RLS");
      }

      const mySpFn = await client.query<{ def: string }>(
        `SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname = 'my_sales_person_id' LIMIT 1`
      );
      const mySpDef = mySpFn.rows[0]?.def ?? "";
      if (!mySpDef.includes("sales_people")) {
        console.error("✗ my_sales_person_id bez fallbacku e-mail — uruchom migrację 072.");
        markFail();
      } else {
        console.log("✓ migracja 072 — my_sales_person_id email fallback");
      }
    } finally {
      await client.end();
    }
  } else {
    console.warn(
      "⚠ Pominięto weryfikację 068–070 (pg_policy, funkcje) — ustaw SUPABASE_DB_PASSWORD w .env.local."
    );

    const { error: rpc069 } = await supabase.rpc("manager_can_access_sales_person", {
      target_sales_person_id: "00000000-0000-0000-0000-000000000000",
    });
    if (rpc069?.message?.includes("Could not find the function")) {
      console.error("✗ Brak migracji 069 — funkcja manager_can_access_sales_person nie istnieje.");
      markFail();
    } else if (rpc069 && !rpc069.message.includes("permission denied")) {
      console.error("✗ Błąd sprawdzania 069:", rpc069.message);
      markFail();
    } else {
      console.log("✓ migracja 069 — funkcje scope kierownika (probe RPC)");
    }
  }

  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
